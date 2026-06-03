"use strict";
/// <reference path="../csgo.d.ts" />
/// <reference path="../common/licenseutil.ts" />
/// <reference path="../common/eventutil.ts" />
/// <reference path="../common/store_items.ts" />
/// <reference path="../common/shopping_cart.ts" />
/// <reference path="../common/add_major_tokens_anim.ts" />
/// <reference path="../common/formattext.ts" />
/// <reference path="../generated/items_event_current_generated_store.d.ts" />
/// <reference path="../generated/items_event_current_generated_store.ts" />
/// <reference path="../popups/popup_acknowledge_item.ts" />
/// <reference path="../itemtile_store.ts" />
var PopupMajorStore;
(function (PopupMajorStore) {
    const defidxStickerItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('sticker');
    const _teamRegionData = [
        { teamid: 89, region: 'eu' },
        { teamid: 12, region: 'eu' },
        { teamid: 142, region: 'eu' },
        { teamid: 135, region: 'eu' },
        { teamid: 139, region: 'eu' },
        { teamid: 106, region: 'eu' },
        { teamid: 81, region: 'eu' },
        { teamid: 60, region: 'eu' },
        { teamid: 59, region: 'eu' },
        { teamid: 0, region: 'eu' },
        { teamid: 119, region: 'eu' },
        { teamid: 115, region: 'eu' },
        { teamid: 137, region: 'eu' },
        { teamid: 69, region: 'eu' },
        { teamid: 135, region: 'eu' },
        { teamid: 95, region: 'eu' },
        { teamid: 0, region: 'eu' },
        { teamid: 85, region: 'am' },
        { teamid: 112, region: 'am' },
        { teamid: 102, region: 'am' },
        { teamid: 126, region: 'am' },
        { teamid: 140, region: 'am' },
        { teamid: 87, region: 'am' },
        { teamid: 104, region: 'am' },
        { teamid: 0, region: 'am' },
        { teamid: 80, region: 'am' },
        { teamid: 48, region: 'am' },
        { teamid: 122, region: 'as' },
        { teamid: 74, region: 'as' },
        { teamid: 127, region: 'as' },
        { teamid: 0, region: 'as' },
        { teamid: 132, region: 'as' }
    ];
    let m_activeMain = null;
    const m_overlayStack = [];
    PopupMajorStore.UpdateAnimationTimer = 5;
    function ClosePopup() {
        $.GetContextPanel().SetReadyForDisplay(false);
        CancelRefreshSubscription($.GetContextPanel());
        CancelRefreshTimerUpdate($.GetContextPanel());
        UiToolkitAPI.HideTextTooltip();
        UiToolkitAPI.HideTitleTextTooltip();
        $.DispatchEvent('CSGOPlaySoundEffect', 'inventory_inspect_close', 'MOUSE');
        $.DispatchEvent('UIPopupButtonClicked', '');
        $.DispatchEvent('ContextMenuEvent', '');
    }
    PopupMajorStore.ClosePopup = ClosePopup;
    function ReadyForDisplay() {
        if (!MyPersonaAPI.IsConnectedToGC()) {
            ClosePopup();
            return;
        }
        let eventId = g_ActiveTournamentInfo.eventid ? g_ActiveTournamentInfo.eventid : -1;
        if (eventId < 0) {
            ClosePopup();
            return;
        }
        const cp = $.GetContextPanel();
        cp.Data().aFlatStickersData = [];
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_GcLogonNotificationReceived', ReadyForDisplay);
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_UpdateConnectionToGC', ReadyForDisplay);
        $.RegisterForUnhandledEvent('PanoramaComponent_Store_VolatileShopSubscribe', (...args) => { OnVolatileShopSubscribe(...args, cp); });
        StoreAPI.VolatileShopSubscribe(g_ActiveTournamentInfo.itemid_dynamic_stickers);
    }
    function Init() {
        let cp = $.GetContextPanel();
        if (!MyPersonaAPI.IsConnectedToGC()) {
            ClosePopup();
            return;
        }
        let eventId = g_ActiveTournamentInfo.eventid ? g_ActiveTournamentInfo.eventid : -1;
        if (eventId < 0) {
            ClosePopup();
            return;
        }
        const stickerPrice = MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, g_ActiveTournamentInfo.stickerids[0]));
        if (!cp.Data().loadDataTimeoutHandler && !stickerPrice) {
            $.GetContextPanel().SetHasClass('data-loading', true);
            _PushOverlay(cp, 'id-major-store-loading');
            cp.Data().loadDataTimeoutHandler = $.Schedule(5, () => {
                UiToolkitAPI.ShowGenericPopupOk($.Localize('#SFUI_SteamConnectionErrorTitle'), $.Localize('#SFUI_Steam_Error_LinkUnexpected'), '', () => $.DispatchEvent('HideContentPanel'));
                ClosePopup();
            });
            return;
        }
        cp.SetHasClass('major-' + eventId, true);
        if (!cp.Data().contextMenuCallbackHandle)
            cp.Data().contextMenuCallbackHandle = UiToolkitAPI.RegisterJSCallback(OnSearchContextMenuCallBack);
        cp.FindChildInLayoutFile('id-major-store-container-inner').AddClass('show');
        PriceRefreshTimerUpdate(cp);
        _UpdateStickerData(cp);
        _SetUpTitleBar(cp, eventId);
        _SetUpTeamsBanner(cp);
        _SetUpPopularityBanner(cp);
        _SetUpBookmarkItemsBanner(cp);
        _SetUpOrgBanners(cp);
        _VariousButtonActionsAndEvents(cp);
        _SetUpFilterPanel(cp);
        _ShowMainPanel(cp, 'id-major-store-banners');
        _UpdateBalance(cp);
        ShoppingCart.cart.subscribeToUpdates(cp, 'cart-counter', () => {
            const numItems = ShoppingCart.cart.getTotalItems();
            cp.SetDialogVariableInt('cart-count', numItems);
            cp.SetDialogVariableInt('cart-value', ShoppingCart.cart.getTotalPrice());
            cp.FindChildInLayoutFile('id-major-store-cart-info').SetHasClass('show', numItems > 0);
            cp.FindChildInLayoutFile('id-major-store-cart-info').TriggerClass('update-count');
        });
    }
    PopupMajorStore.Init = Init;
    function OnVolatileShopSubscribe(nContainerDef, bNewPricesParsed, cp) {
        if (nContainerDef != g_ActiveTournamentInfo.itemid_dynamic_stickers)
            return;
        if (cp.Data().loadDataTimeoutHandler) {
            $.CancelScheduled(cp.Data().loadDataTimeoutHandler);
            cp.Data().loadDataTimeoutHandler = null;
            _PopOverlay();
            Init();
            return;
        }
        RefreshSubscription(cp);
        PriceRefreshTimerUpdate(cp);
        if (bNewPricesParsed) {
            _UpdateStickerData(cp);
            cp.Data().stopTileUpdate = false;
            _UpdateVisiblePanel(cp, true);
            $.Schedule(1, () => { cp.Data().stopTileUpdate = true; });
            ShoppingCart.cart.syncPrices((itemId) => {
                const item = cp.Data().aFlatStickersData.find(i => i.itemId === itemId);
                return item ? item.price : undefined;
            });
        }
    }
    function _UpdateVisiblePanel(cp, bDisableScroll = false) {
        cp.Data().stopTileUpdate = false;
        if (m_activeMain?.id === 'id-major-store-single-view') {
            const elPanel = cp.FindChildInLayoutFile('id-major-store-single-view');
            if (elPanel.Data().SingleViewDisplayedStickers) {
                _SetUpSingleView(cp, elPanel.Data().SingleViewDisplayedStickers);
            }
        }
        else if (m_activeMain?.id === 'id-major-store-team-view') {
            const elPanel = cp.FindChildInLayoutFile('id-major-store-team-view');
            if (elPanel.Data().DisplayedTeam) {
                _SetUpTeamView(cp, elPanel.Data().DisplayedTeam);
            }
        }
        else if (m_activeMain?.id === 'id-major-store-banners') {
            _SetUpPopularityBanner(cp);
            _SetUpBookmarkItemsBanner(cp);
        }
        else if (m_activeMain?.id === 'id-major-store-content') {
            _UpdateItemsList(cp, bDisableScroll);
        }
    }
    function GetNewMarketPrice(itemId) {
        const item = $.GetContextPanel().Data().aFlatStickersData.find(i => i.itemId === itemId);
        return item ? item.price : undefined;
    }
    PopupMajorStore.GetNewMarketPrice = GetNewMarketPrice;
    function RefreshSubscription(cp) {
        if (!cp || !cp.IsValid())
            return;
        CancelRefreshSubscription(cp);
        StoreAPI.VolatileShopSubscribe(g_ActiveTournamentInfo.itemid_dynamic_stickers);
        cp.Data().refreshSubscriptionHandle = $.Schedule(150, () => RefreshSubscription(cp));
    }
    PopupMajorStore.RefreshSubscription = RefreshSubscription;
    function CancelRefreshSubscription(cp) {
        if (cp.Data().refreshSubscriptionHandle) {
            $.CancelScheduled(cp.Data().refreshSubscriptionHandle);
            cp.Data().refreshSubscriptionHandle = null;
        }
    }
    PopupMajorStore.CancelRefreshSubscription = CancelRefreshSubscription;
    function PriceRefreshTimerUpdate(cp) {
        if (!cp || !cp.IsValid())
            return;
        CancelRefreshTimerUpdate(cp);
        const nSeconds = StoreAPI.GetSecondsUntilPendingPriceUpdate(g_ActiveTournamentInfo.itemid_dynamic_stickers);
        const elRefresh = cp.FindChildInLayoutFile('id-major-store-refresh');
        const timer = cp.FindChildInLayoutFile('id-major-store-refresh-time');
        timer.text = $.Localize("#major_store_prices_updated");
        if (nSeconds <= 0) {
            CancelRefreshTimerUpdate(cp);
            elRefresh.SetPanelEvent('onmouseover', () => {
                UiToolkitAPI.ShowTextTooltip('id-major-store-refresh', '#major_store_prices_updated_tooltip');
            });
            elRefresh.SetPanelEvent('onmouseout', () => {
                UiToolkitAPI.HideTextTooltip();
            });
            elRefresh.SetHasClass('alert', false);
            return;
        }
        elRefresh.SetPanelEvent('onmouseover', () => {
            UiToolkitAPI.ShowTextTooltip('id-major-store-refresh', '#major_store_refesh_tooltip');
        });
        elRefresh.SetPanelEvent('onmouseout', () => {
            UiToolkitAPI.HideTextTooltip();
        });
        elRefresh.SetHasClass('alert', true);
        timer.SetDialogVariable('timer', FormatText.SecondsToDDHHMMSSWithSymbolSeperator(nSeconds));
        timer.text = nSeconds > 1 ?
            $.Localize('#major_store_refresh_timer', timer) :
            $.Localize('#major_store_refresh_soon');
        cp.Data().priceRefreshHandler = $.Schedule(1, () => PriceRefreshTimerUpdate(cp));
    }
    PopupMajorStore.PriceRefreshTimerUpdate = PriceRefreshTimerUpdate;
    function CancelRefreshTimerUpdate(cp) {
        if (cp.Data().priceRefreshHandler) {
            $.CancelScheduled(cp.Data().priceRefreshHandler);
            cp.Data().priceRefreshHandler = null;
        }
    }
    PopupMajorStore.CancelRefreshTimerUpdate = CancelRefreshTimerUpdate;
    function _UpdateStickerData(cp) {
        const teams = g_ActiveTournamentTeams;
        const oldStickersData = new Map();
        if (cp.Data().aFlatStickersData.length > 0) {
            for (let i = 0; i < cp.Data().aFlatStickersData.length; i++) {
                oldStickersData.set(cp.Data().aFlatStickersData[i].rawId, cp.Data().aFlatStickersData[i]);
            }
        }
        function _UpdateDataWithCurrentData(id, oData) {
            const stickerData = oldStickersData.get(id);
            if (stickerData) {
                const livePrice = _GetCurrentPriceForItem(stickerData.itemId);
                if (livePrice !== undefined && stickerData.price !== undefined) {
                    stickerData.oldPrice = stickerData.price;
                    stickerData.price = livePrice;
                    stickerData.popularity = _GetCurrentTrend(stickerData.itemId);
                }
            }
            else {
                cp.Data().aFlatStickersData.push(_GetStickerData(oData));
            }
        }
        teams.forEach(team => {
            team.stickerids.forEach(id => {
                const oData = {
                    rawId: id,
                    isPlayer: false,
                    isOrg: false,
                    teamId: team.teamid,
                    team: team.team,
                };
                _UpdateDataWithCurrentData(id, oData);
            });
            team.players.forEach(player => {
                player.stickerids.forEach(id => {
                    const oData = {
                        rawId: id,
                        isPlayer: true,
                        isOrg: false,
                        teamId: team.teamid,
                        team: team.team,
                        playerCode: player.code
                    };
                    _UpdateDataWithCurrentData(id, oData);
                });
            });
        });
        const aOrgStickers = g_ActiveTournamentInfo.stickerids;
        aOrgStickers.forEach((id, idx) => {
            const oData = {
                rawId: id,
                isPlayer: false,
                isOrg: true,
                playerCode: g_ActiveTournamentInfo.location + ' ' + g_ActiveTournamentInfo.organization
            };
            _UpdateDataWithCurrentData(id, oData);
        });
        const prices = cp.Data().aFlatStickersData.map(i => i.price);
        const min = prices.length ? Math.min(...prices) : 0;
        const max = prices.length ? Math.max(...prices) : 0;
        cp.Data().minPrice = min;
        cp.Data().maxPrice = max;
    }
    function _GetStickerData(oData) {
        const itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, oData.rawId);
        const numRarity = InventoryAPI.GetItemRarity(itemId);
        const teamInRegion = ('teamId' in oData) ? _teamRegionData.filter(team => team.teamid === oData.teamId) : [];
        const teamRegion = (teamInRegion.length > 0) ? teamInRegion[0].region : '';
        return {
            isPlayer: oData.isPlayer,
            isOrg: ('isOrg' in oData) ? oData.isOrg : false,
            rawId: oData.rawId,
            teamName: $.Localize('#CSGO_TeamID_' + oData.teamId),
            teamId: oData.teamId,
            teamTag: oData.team,
            playerCode: ('playerCode' in oData) ? oData.playerCode : '',
            realName: oData.isPlayer ? $.Localize('#SFUI_ProPlayer_' + oData.playerCode) : '',
            itemId: itemId,
            price: _GetCurrentPriceForItem(itemId),
            rarity: numRarity,
            rarityLookup: $.Localize('#major_store_filter_type_' + numRarity),
            name: InventoryAPI.GetItemName(itemId),
            displayName: ItemInfo.GetFormattedName(itemId),
            popularity: _GetCurrentTrend(itemId),
            teamRegion: teamRegion
        };
    }
    function _GetCurrentPriceForItem(itemId) {
        return MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, itemId);
    }
    function _GetCurrentTrend(itemId) {
        return MissionsAPI.GetSeasonalOperationFauxItemTrend(g_ActiveTournamentInfo.credits_id, itemId, 'trend');
    }
    function UnreadyForDisplay() {
    }
    function _VariousButtonActionsAndEvents(cp) {
        cp.FindChildInLayoutFile('id-major-store-container').AddBlurPanel(cp.FindChildInLayoutFile('id-major-store-filters-panel'));
        cp.FindChildInLayoutFile('id-major-store-container').AddBlurPanel(cp.FindChildInLayoutFile('id-major-store-loading'));
        cp.FindChildInLayoutFile('id-major-store-container').AddBlurPanel(cp.FindChildInLayoutFile('id-major-store-search-results'));
        cp.FindChildInLayoutFile('id-list-large-icons').SetPanelEvent('onactivate', () => {
            _MakeDelayedLoadList(cp);
        });
        cp.FindChildInLayoutFile('id-list-small-icons').SetPanelEvent('onactivate', () => {
            _MakeDelayedLoadList(cp);
        });
        cp.FindChildInLayoutFile('id-list-large-icons').checked = true;
        cp.FindChildInLayoutFile('id-major-store-sort-dropdown').SetPanelEvent('oninputsubmit', () => {
            _UpdateItemsList(cp);
        });
        cp.FindChildInLayoutFile('id-major-store-content-home-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            _ShowMainPanel(cp, 'id-major-store-banners');
        });
        cp.FindChildInLayoutFile('id-major-store-team-view-home-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            _ShowMainPanel(cp, 'id-major-store-banners');
        });
        cp.FindChildInLayoutFile('id-major-store-single-view-back-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            _ShowMainPanel(cp, 'id-major-store-team-view');
        });
        cp.FindChildInLayoutFile('id-popup-major-store-back-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            _ShowMainPanel(cp, 'id-major-store-banners');
        });
        cp.FindChildInLayoutFile('id-major-store-balance').SetPanelEvent('onmouseover', () => {
            cp.FindChildInLayoutFile('id-major-store-balance').SetDialogVariable('local-price', StoreAPI.GetStoreItemTokensBundlePrice('' + g_ActiveTournamentInfo.itemid_charge, 100, ''));
            const tooltip = $.Localize('#major_store_balance_tooltip', cp.FindChildInLayoutFile('id-major-store-balance'));
            UiToolkitAPI.ShowTitleTextTooltip('id-major-store-balance', '#CSGO_TournamentPass_' + g_ActiveTournamentInfo.location + '_credits', tooltip);
        });
        cp.FindChildInLayoutFile('id-major-store-balance').SetPanelEvent('onmouseout', () => {
            UiToolkitAPI.HideTitleTextTooltip();
        });
        cp.FindChildInLayoutFile('id-major-store-receipt').SetPanelEvent('onmouseover', () => {
            UiToolkitAPI.ShowTextTooltip('id-major-store-receipt', '#major_store_balance_receipt');
        });
        cp.FindChildInLayoutFile('id-major-store-receipt').SetPanelEvent('onmouseout', () => {
            UiToolkitAPI.HideTextTooltip();
        });
        cp.FindChildInLayoutFile('id-major-store-receipt').SetPanelEvent('onactivate', () => {
            SteamOverlayAPI.OpenUrlInOverlayOrExternalBrowser("https://" + SteamOverlayAPI.GetSteamCommunityURL() + "/my/gcpd/" + SteamOverlayAPI.GetAppID() + "/?tab=creditsaudit");
        });
        function _Callback() {
            _UpdateBalance(cp);
        }
        ;
        const callback = UiToolkitAPI.RegisterJSCallback(_Callback);
        cp.FindChildInLayoutFile('id-major-store-cart-btn').SetPanelEvent('onactivate', () => {
            $.DispatchEvent("CSGOPlaySoundEffect", "UIPanorama.loadout_sector_select", "MOUSE");
            const popupPanel = UiToolkitAPI.ShowCustomLayoutPopupParameters('id-popup-shopping-cart-checkout', 'file://{resources}/layout/popups/popup_shopping_cart_checkout.xml', '&callback=' + callback);
            popupPanel.Data().eventId = cp.Data().eventId;
        });
        cp.FindChildInLayoutFile('id-major-store-cart-btn').SetPanelEvent('onmouseover', () => {
            UiToolkitAPI.ShowTextTooltip('id-major-store-cart-btn', '#major_store_checkout_empty_desc');
        });
        cp.FindChildInLayoutFile('id-major-store-cart-btn').SetPanelEvent('onmouseout', () => {
            UiToolkitAPI.HideTextTooltip();
        });
        const elSearchBox = cp.FindChildInLayoutFile('id-major-store-search-box');
        elSearchBox.SetPanelEvent('ontextentrychange', () => {
            _Debounce(cp, 'textDebounceTimeoutHandle', .3, () => { _ShowSearchResults(cp, _GetItemsForSearch(cp, elSearchBox.text)); });
        });
        elSearchBox.SetPanelEvent('ontextentrysubmit', () => {
            _ShowSearchResults(cp, _GetItemsForSearch(cp, elSearchBox.text));
        });
        cp.FindChildInLayoutFile('id-major-store-see-all-teams-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            _ShowMainPanel(cp, 'id-major-store-content');
        });
        cp.FindChildInLayoutFile('id-major-store-see-all-popular-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            _ShowMainPanel(cp, 'id-major-store-content');
            const elDropDown = cp.FindChildInLayoutFile('id-major-store-sort-dropdown');
            elDropDown.SetSelected('popularity-high-low');
        });
        cp.FindChildInLayoutFile('id-major-store-see-all-bookmarked-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            cp.Data().useBookMarkList = true;
            _ShowMainPanel(cp, 'id-major-store-content');
        });
        cp.FindChildInLayoutFile('id-major-store-filters-panel').SetPanelEvent('onactivate', () => {
        });
        cp.FindChildInLayoutFile('id-major-store-search-results').SetPanelEvent('onactivate', () => {
        });
        const elFloatingFilterPanel = cp.FindChildInLayoutFile('id-major-fullscreen-filter');
        cp.FindChildInLayoutFile('id-major-store-sort-filter-btn').SetPanelEvent('onactivate', () => {
            elFloatingFilterPanel.visible = true;
            _PushOverlay(cp, 'id-major-fullscreen-filter');
        });
        cp.FindChildInLayoutFile('id-major-fullscreen-filter-btn').SetPanelEvent('onactivate', () => {
            _PopOverlay();
        });
        cp.FindChildInLayoutFile('id-major-fullscreen-text-search-btn').SetPanelEvent('onactivate', () => {
            _PopOverlay();
        });
        cp.FindChildInLayoutFile('id-major-store-filters-close').SetPanelEvent('onactivate', () => {
            _PopOverlay();
        });
        function fnOnPropertyTransitionEndEvent(panel, propertyName) {
            if (elFloatingFilterPanel === panel && propertyName === 'opacity') {
                if (elFloatingFilterPanel.visible === true && !panel.BIsTransparent()) {
                    return true;
                }
                if (propertyName === 'opacity') {
                    if (elFloatingFilterPanel.visible === true && elFloatingFilterPanel.BIsTransparent()) {
                        elFloatingFilterPanel.visible = false;
                        return true;
                    }
                }
                return false;
            }
        }
        $.RegisterEventHandler('PropertyTransitionEnd', elFloatingFilterPanel, fnOnPropertyTransitionEndEvent);
        AddMajorTokensAnim.SetTransitionEndEvent(cp.FindChildInLayoutFile('id-major-store-add-tokens'));
        const elBookmark = cp.FindChildInLayoutFile('id-major-store-banners-bookmarks');
        $.RegisterEventHandler('PropertyTransitionEnd', elBookmark, (panel, propertyName) => {
            if (elBookmark.id === panel.id && propertyName === 'opacity') {
                if (elBookmark.visible === true && elBookmark.BIsTransparent()) {
                    elBookmark.visible = false;
                    return true;
                }
            }
            return false;
        });
    }
    function _MakeDelayedLoadList(cp) {
        let lister = cp.FindChildInLayoutFile('id-major-store-items-lister');
        const btn = cp.FindChildInLayoutFile('id-list-large-icons');
        const selectedBtn = btn.GetSelectedButton();
        const snippetType = selectedBtn.GetAttributeString('data-type', '');
        if (lister && lister.IsValid() && snippetType == lister.GetAttributeString('data-type', '')) {
            _UpdateItemsList(cp);
            return;
        }
        if (lister)
            lister.DeleteAsync(0);
        lister = $.CreatePanel('JSDelayLoadList', cp.FindChildInLayoutFile('id-major-store-content-page'), 'id-major-store-items-lister');
        lister.BLoadLayoutSnippet(snippetType);
        $.Schedule(.15, () => _UpdateItemsList(cp));
    }
    function _SetUpTitleBar(cp, eventId) {
        cp.SetDialogVariable('tournament_name', $.Localize('#CSGO_Tournament_Event_NameShort_' + eventId));
        cp.FindChildInLayoutFile('id-major-store-major-logo').SetImage('file://{images}/tournaments/events/tournament_logo_' + eventId + '.svg');
    }
    function _SetUpTeamsBanner(cp) {
        const teams = g_ActiveTournamentTeams;
        const elParent = cp.FindChildInLayoutFile('id-major-store-banner-teams');
        teams.forEach(team => {
            const elPanel = $.CreatePanel('Button', elParent, '');
            elPanel.BLoadLayoutSnippet('banner-team-box');
            elPanel.FindChildInLayoutFile('id-team-icon').SetImage('file://{images}/tournaments/teams/' + team.team + '.svg');
            elPanel.FindChildInLayoutFile('id-team-icon-blur').SetImage('file://{images}/tournaments/teams/' + team.team + '.svg');
            elPanel.SetDialogVariable('name', $.Localize('#CSGO_TeamID_' + team.teamid));
            elPanel.style.backgroundPosition = Math.floor(Math.random() * 100) + '% 50%';
            elPanel.SetPanelEvent('onactivate', () => {
                _SetUpTeamView(cp, team);
                _ShowMainPanel(cp, 'id-major-store-team-view');
                $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.submenu_leveloptions_select', 'MOUSE');
            });
        });
    }
    function _SetUpPopularityBanner(cp) {
        const aSorted = cp.Data().aFlatStickersData.toSorted((a, b) => {
            if (a.popularity != b.popularity)
                return b.popularity - a.popularity;
            else if (a.price != b.price)
                return b.price - a.price;
            else
                return a.rawId - b.rawId;
        });
        const numToShow = 40;
        const elParent = cp.FindChildInLayoutFile('id-major-store-banner-popular');
        const numTilesPerPage = 5;
        let numPages = 0;
        let elCarouselPage = null;
        for (let i = 0; i < numToShow; i++) {
            if (i % numTilesPerPage === 0) {
                elCarouselPage = elParent.FindChildInLayoutFile('id-major-store-carousel-page-' + numPages);
                if (!elCarouselPage) {
                    elCarouselPage = $.CreatePanel('Panel', elParent, 'id-major-store-carousel-page-' + numPages, { class: 'popup-major-store__banner__popular_page' });
                }
                numPages++;
            }
            if (elCarouselPage) {
                let elPanel = elCarouselPage.FindChildInLayoutFile('id-carousel-sticker' + i);
                if (!elPanel) {
                    elPanel = $.CreatePanel('Panel', elCarouselPage, 'id-carousel-sticker' + i);
                    elPanel.BLoadLayoutSnippet('banner-popular-entry');
                }
                elPanel.SetDialogVariableInt('position', i + 1);
                aSorted[i].popularityRank = i;
                const elTile = elPanel.FindChildInLayoutFile('id-popular-tile');
                _UpdateTile(cp, elTile, aSorted, i);
            }
        }
    }
    function _GetBookmarkedItemsList(cp) {
        const stickerMap = new Map();
        for (const sticker of cp.Data().aFlatStickersData) {
            stickerMap.set(sticker.rawId.toString(), sticker);
        }
        const aDefIndexes = GameInterfaceAPI.GetSettingString('cl_major_store_watch_list').split(',');
        return aDefIndexes.map(defIndex => stickerMap.get(defIndex)).filter((sticker) => sticker !== undefined).reverse();
    }
    function _SetUpBookmarkItemsBanner(cp) {
        const aSorted = _GetBookmarkedItemsList(cp);
        if (aSorted.length < 1) {
            cp.FindChildInLayoutFile('id-major-store-banners-bookmarks').SetHasClass('show', false);
            cp.FindChildInLayoutFile('id-major-store-bookmark-hint').visible = true;
            return;
        }
        cp.FindChildInLayoutFile('id-major-store-banners-bookmarks').SetHasClass('show', true);
        cp.FindChildInLayoutFile('id-major-store-banners-bookmarks').visible = true;
        cp.FindChildInLayoutFile('id-major-store-bookmark-hint').visible = false;
        const elParent = cp.FindChildInLayoutFile('id-major-store-banner-bookmarked');
        const numTilesPerPage = 8;
        const totalPages = Math.ceil(aSorted.length / numTilesPerPage);
        for (let i = 0; i < totalPages; i++) {
            let elCarouselPage = elParent.FindChildInLayoutFile('id-major-store-carousel-page-' + i);
            if (!elCarouselPage) {
                elCarouselPage = $.CreatePanel('Panel', elParent, 'id-major-store-carousel-page-' + i, { class: 'popup-major-store__banner__popular_page' });
                elCarouselPage.SetHasClass('small', true);
                elCarouselPage.SetHasClass('banner-bookmark', true);
            }
            const startIndex = i * numTilesPerPage;
            for (let j = 0; j < numTilesPerPage; j++) {
                let stickerIndex = startIndex + j;
                let elPanel = elCarouselPage.FindChildInLayoutFile('id-carousel-sticker' + stickerIndex);
                if (!elPanel) {
                    elPanel = $.CreatePanel('Panel', elCarouselPage, 'id-carousel-sticker' + stickerIndex);
                    elPanel.BLoadLayoutSnippet('store-tile');
                }
                if (aSorted[stickerIndex]) {
                    _UpdateTile(cp, elPanel, aSorted, stickerIndex);
                    elPanel.SetHasClass('hidden', false);
                    elPanel.enabled = true;
                    elPanel.hittest = true;
                }
                else {
                    elPanel.SetHasClass('hidden', true);
                    elPanel.enabled = false;
                    elPanel.hittest = false;
                }
            }
        }
        if (elParent.Children().length > totalPages) {
            const numPanelsToDelete = elParent.Children().length - totalPages;
            const numPagesMade = elParent.Children().length - 1;
            for (let i = numPagesMade; i > (numPagesMade - numPanelsToDelete); i--) {
                elParent.Children()[i].DeleteAsync(0);
            }
        }
    }
    function _IsItemBookmarked(defidx) {
        return GameInterfaceAPI.GetSettingString('cl_major_store_watch_list').split(',').includes(defidx.toString());
    }
    function _UpdateBookmarkSetting(cp, reusePanel, defidx) {
        const aItemIds = GameInterfaceAPI.GetSettingString('cl_major_store_watch_list').split(',');
        const idIndex = aItemIds.findIndex(id => id === defidx.toString());
        if (idIndex === -1) {
            aItemIds.push(defidx.toString());
        }
        else {
            aItemIds.splice(idIndex, 1);
        }
        GameInterfaceAPI.SetSettingString('cl_major_store_watch_list', aItemIds.length > 0 ? aItemIds.join(',') : "");
        if (m_activeMain?.id === 'id-major-store-banners') {
            _SetUpBookmarkItemsBanner(cp);
            _SetUpPopularityBanner(cp);
        }
        else if (m_activeMain?.id === 'id-major-store-banners') {
            _SetUpBookmarkItemsBanner(cp);
            _SetUpPopularityBanner(cp);
        }
        if (cp.Data().useBookMarkList) {
            _UpdateItemsList(cp, true);
        }
    }
    function _SetUpOrgBanners(cp) {
        cp.SetDialogVariable('org-name', g_ActiveTournamentInfo.organization);
        const elParent = cp.FindChildInLayoutFile('id-major-store-banner-org-stickers');
        const aFilteredStickers = cp.Data().aFlatStickersData.filter(sticker => (sticker.isOrg === true));
        aFilteredStickers.forEach((sticker, idx) => {
            let elPanel = elParent.FindChildInLayoutFile('id-org-sticker-' + idx);
            if (!elPanel) {
                elPanel = $.CreatePanel('Panel', elParent, 'id-org-sticker-' + idx);
                elPanel.BLoadLayoutSnippet('store-tile');
            }
            _UpdateTile(cp, elPanel, aFilteredStickers, idx);
        });
    }
    function _SetUpTeamView(cp, team) {
        const elPanel = cp.FindChildInLayoutFile('id-major-store-team-view');
        elPanel.Data().DisplayedTeam = team;
        const teamName = $.Localize('#CSGO_TeamID_' + team.teamid);
        elPanel.SetDialogVariable('team-name', teamName);
        const elTilesContainer = cp.FindChildInLayoutFile('id-major-store-team-tiles');
        const numTiles = 6;
        for (let i = 0; i < numTiles; i++) {
            const elPackTile = elTilesContainer.FindChildInLayoutFile('sticker-pack-' + i);
            const elPackLabel = elPackTile.FindChildInLayoutFile('team-pack-major');
            elPackLabel.SetDialogVariableLocString('event-name', '#CSGO_Tournament_Event_Location_' + g_ActiveTournamentInfo.eventid);
            elPackLabel.text = $.Localize('#major_store_team_stickers-made', elPackLabel);
            const elBg = elPackTile.FindChildInLayoutFile('team-pack-bg-logo');
            elBg.SetImage('file://{images}/tournaments/teams/' + team.team + '.svg');
            elPackTile.SetDialogVariable('title', i === 0 ? teamName : team.players[i - 1].nick);
            elPackTile.SetHasClass('player', i > 0);
            const elStickerContainer = elPackTile.FindChildInLayoutFile('team-pack-icons');
            const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
            const createRandomizer = (pool) => () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            const drawRandom = createRandomizer([0, 1, 2, 3]);
            let xpos = 0;
            let prices = [];
            const stickers = i === 0 ?
                cp.Data().aFlatStickersData.filter(sticker => (!sticker.isPlayer && sticker.teamId === team.teamid)) :
                cp.Data().aFlatStickersData.filter(sticker => (sticker.isPlayer && sticker.playerCode === team.players[i - 1].code));
            stickers.forEach((id, idx) => {
                prices.push(stickers[idx].price);
                let sticker = elStickerContainer.FindChild('pack-sticker' + idx);
                if (!sticker)
                    sticker = $.CreatePanel('ItemImage', elStickerContainer, 'pack-sticker' + idx, { scaling: 'stretch-to-fit-preserve-aspect' });
                sticker.itemid = stickers[idx].itemId;
                const zIndex = drawRandom();
                const rotationSetting = zIndex == 3 ? getRandomInt(-15, 15) : getRandomInt(-95, 85);
                sticker.style.transform = 'rotateZ(' + rotationSetting + 'deg) translateY(-' + getRandomInt(8, 30) + 'px) translateX(' + getRandomInt(xpos, xpos + 35) + 'px)';
                xpos = xpos + 50;
                sticker.style.zIndex = zIndex + ';';
                sticker.style.brightness = zIndex === 0 ? '.5' : zIndex === 1 ? '.7' : zIndex === 2 ? '.8' : zIndex === 3 ? '1.1' : '1';
            });
            elPackTile.SetDialogVariableInt('low-price', Math.min(...prices));
            elPackTile.SetDialogVariableInt('high-price', Math.max(...prices));
            elPackTile.SetPanelEvent('onactivate', () => {
                _ShowMainPanel(cp, 'id-major-store-single-view');
                _SetUpSingleView(cp, stickers);
                $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.submenu_leveloptions_select', 'MOUSE');
            });
        }
    }
    function _SetUpSingleView(cp, aStickers) {
        const elPanel = cp.FindChildInLayoutFile('id-major-store-single-view');
        elPanel.SetDialogVariable('team-name', aStickers[0].isPlayer ? aStickers[0].playerCode : $.Localize('#CSGO_TeamID_' + aStickers[0].teamId));
        const numTiles = 4;
        const elParent = elPanel.FindChildInLayoutFile('id-major-store-single-tiles');
        for (let i = 0; i < numTiles; i++) {
            const elPackTile = elParent.FindChildInLayoutFile('sticker-single-' + i);
            _UpdateTile(cp, elPackTile, aStickers, i);
        }
        elPanel.Data().SingleViewDisplayedStickers = aStickers;
    }
    function GetFakeStickers() {
        const fakeItems = ['4295199751', '4295199753'];
        return fakeItems[Math.floor(Math.random() * (1 - 0 + 1)) + 0];
    }
    function _UpdateBalance(cp) {
        const idxLookup = InventoryAPI.GetCacheTypeElementIndexByKey('SeasonalOperations', g_ActiveTournamentInfo.credits_id);
        let nRedeemableBalance = 0;
        if (g_ActiveTournamentInfo.credits_id == InventoryAPI.GetCacheTypeElementFieldByIndex('SeasonalOperations', idxLookup, 'season_value')) {
            nRedeemableBalance = InventoryAPI.GetCacheTypeElementFieldByIndex('SeasonalOperations', idxLookup, 'redeemable_balance');
            nRedeemableBalance = (nRedeemableBalance === null || nRedeemableBalance === undefined) ? 0 : nRedeemableBalance;
        }
        if (cp.Data().activatedCredits > 0) {
            const elNotification = cp.FindChildInLayoutFile('id-major-store-add-tokens');
            _PushOverlay(cp, 'id-major-store-add-tokens');
            const tempBalance = nRedeemableBalance - cp.Data().activatedCredits;
            cp.SetDialogVariableInt('balance', tempBalance);
            function CallAtEndAnimation() {
                _PopOverlay();
                cp.FindChildInLayoutFile('id-major-store-balance').TriggerClass('popup-major-store__top-bar__balance-anim');
                cp.SetDialogVariableInt('balance', nRedeemableBalance);
            }
            AddMajorTokensAnim.StartAnim(elNotification, cp.FindChildInLayoutFile('id-major-store-balance'), cp.Data().activatedCredits, CallAtEndAnimation);
            cp.Data().activatedCredits = 0;
        }
        else {
            cp.SetDialogVariableInt('balance', nRedeemableBalance);
        }
    }
    function _PreSetFilters(cp, filterId) {
        const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
        elFilterPanel.FindChildInLayoutFile(filterId).checked = true;
    }
    function _UpdateItemsList(cp, bDisableScroll = false) {
        const elParent = cp.FindChildInLayoutFile('id-major-store-content-page');
        let elLister = elParent.FindChildInLayoutFile('id-major-store-items-lister');
        const filteredList = _GetFilteredSortedIds(cp);
        elLister.SetLoadListItemFunction((elLister, nPanelIdx, reusePanel) => {
            if (!reusePanel || !reusePanel.IsValid()) {
                reusePanel = $.CreatePanel('Panel', elLister, '');
                reusePanel.BLoadLayoutSnippet('store-tile');
                reusePanel.SetHasClass('major-store__item_tile', true);
            }
            _UpdateTile(cp, reusePanel, filteredList, nPanelIdx);
            return reusePanel;
        });
        elLister.UpdateListItems(filteredList.length);
        cp.SetDialogVariableInt('item-count', filteredList.length);
        if (!bDisableScroll)
            elLister.ScrollToTop();
    }
    function _UpdateFilterSettings(cp) {
        const elDropDown = cp.FindChildInLayoutFile('id-major-store-sort-dropdown');
        let numFiltersSelected = 0;
        const elNavBarFiltersParent = cp.FindChildInLayoutFile('id-major-store-filters-active');
        elNavBarFiltersParent.Children().forEach(btn => btn.DeleteAsync(0));
        let priceFilter = { min: 0, max: 0 };
        const aTeams = _GetFilteredTeams(cp);
        if (aTeams.length > 0) {
            aTeams.forEach(selectedBtn => {
                numFiltersSelected++;
                _MakeNavBarFilterButton(cp, elNavBarFiltersParent, selectedBtn, '#CSGO_TeamID_' + selectedBtn.Data().teamid, "id-filter-active-r-" + selectedBtn.Data().teamid);
            });
        }
        const aRarities = _GetFilteredRarities(cp);
        if (aRarities.length > 0) {
            aRarities.forEach(selectedBtn => {
                numFiltersSelected++;
                _MakeNavBarFilterButton(cp, elNavBarFiltersParent, selectedBtn, '#major_store_filter_type_' + selectedBtn.Data().rarity, "id-filter-active-r-" + selectedBtn.Data().rarity);
            });
        }
        const btnTeamOnly = cp.FindChildInLayoutFile('id-major-store-filter-team');
        if (btnTeamOnly.checked) {
            numFiltersSelected++;
            _MakeNavBarFilterButton(cp, elNavBarFiltersParent, btnTeamOnly, '#major_store_filter_type_team_only', "id-filter-active-t-only");
        }
        const btnPlayerOnly = cp.FindChildInLayoutFile('id-major-store-filter-player');
        if (btnPlayerOnly.checked) {
            numFiltersSelected++;
            _MakeNavBarFilterButton(cp, elNavBarFiltersParent, btnPlayerOnly, '#major_store_filter_type_player_only', "id-filter-active-p-only");
        }
        const elSearchBox = cp.FindChildInLayoutFile('id-major-store-search-box');
        if (elSearchBox.text) {
            numFiltersSelected++;
            const elActiveFilterBtn = $.CreatePanel('Button', elNavBarFiltersParent, 'id-filter-active-search-txt');
            elActiveFilterBtn.BLoadLayoutSnippet('active-filter-button');
            elActiveFilterBtn.SetDialogVariable('search-text', elSearchBox.text);
            elActiveFilterBtn.SetDialogVariable('name', $.Localize('#major_store_filter_type_search_text', elActiveFilterBtn));
            elNavBarFiltersParent.MoveChildBefore(elActiveFilterBtn, elNavBarFiltersParent.Children()[0]);
            elActiveFilterBtn.SetPanelEvent('onactivate', () => {
                _ClearTextSearch(cp);
                _UpdateItemsList(cp);
                elActiveFilterBtn.DeleteAsync(0);
            });
        }
        cp.FindChildInLayoutFile('id-filter-active-clear_all').visible = numFiltersSelected > 1;
        cp.FindChildInLayoutFile('id-major-store-filters-clear').visible = numFiltersSelected > 1;
        let sortDirection = 'asc';
        let sortType = elDropDown.GetSelected().id || 'default';
        switch (sortType) {
            case 'price-high-low':
                sortDirection = 'desc';
                sortType = 'price';
            case 'price-low-high':
                sortType = 'price';
                break;
            case 'popularity-high-low':
                sortDirection = 'desc';
                sortType = 'popularity';
                break;
            case 'popularity-low-high':
                sortType = 'popularity';
                break;
        }
        return {
            selectedTeamIds: aTeams.flatMap(team => team.Data().teamid),
            sort: sortType,
            rarity: aRarities.flatMap(panel => panel.Data().rarity),
            teamsOnly: btnTeamOnly.checked,
            playersOnly: cp.FindChildInLayoutFile('id-major-store-filter-player').checked,
            sortDirection: sortDirection,
            price: priceFilter,
            searchText: elSearchBox.text
        };
    }
    function _MakeNavBarFilterButton(cp, elParent, selectedFilterBtn, locString, idForBtn) {
        const elActiveFilterBtn = $.CreatePanel('Button', elParent, idForBtn);
        elActiveFilterBtn.BLoadLayoutSnippet('active-filter-button');
        elActiveFilterBtn.SetDialogVariable('name', $.Localize(locString, selectedFilterBtn));
        elActiveFilterBtn.SetPanelEvent('onactivate', () => {
            selectedFilterBtn.checked = false;
            _UpdateItemsList(cp);
            elActiveFilterBtn.DeleteAsync(0);
        });
    }
    function _OnActivateClearAll(cp, doNotClearSearch = false, doNotClearBookmarks = false) {
        const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
        elFilterPanel.FindChildrenWithAttributeTraverse('filter-button').forEach(btn => btn.checked = false);
        if (!doNotClearBookmarks) {
            cp.Data().useBookMarkList = false;
        }
        if (!doNotClearSearch) {
            _ClearTextSearch(cp);
        }
        const elDropDown = cp.FindChildInLayoutFile('id-major-store-sort-dropdown');
        elDropDown.SetSelected('default');
    }
    function _ClearTextSearch(cp) {
        const elSearchBox = cp.FindChildInLayoutFile('id-major-store-search-box');
        elSearchBox.ClearSelection();
        elSearchBox.text = '';
    }
    function _UpdateTile(cp, reusePanel, filteredList, nPanelIdx) {
        const stickerData = filteredList[nPanelIdx];
        reusePanel.SetDialogVariable('title', stickerData.isPlayer ?
            stickerData.playerCode :
            stickerData.isOrg ?
                g_ActiveTournamentInfo.organization :
                stickerData.teamName);
        const elChange = reusePanel.FindChildInLayoutFile('id-store-item-price-change');
        if (stickerData.oldPrice !== undefined && stickerData.oldPrice !== stickerData.price) {
            const nDifference = stickerData.price - stickerData.oldPrice;
            reusePanel.SetDialogVariableInt('price-change', Math.abs(nDifference));
            elChange.SetHasClass('show-change', false);
            elChange.SwitchClass('direction', stickerData.price > stickerData.oldPrice ? 'higher' : 'lower');
            if (cp.Data().stopTileUpdate) {
                elChange.SetHasClass('show-change', true);
            }
            else {
                reusePanel.FindChildInLayoutFile('id-store-item-price-loading').visible = true;
                $.Schedule(1, () => {
                    reusePanel.FindChildInLayoutFile('id-store-item-price-loading').visible = false;
                    elChange.SetHasClass('show-change', true);
                });
            }
        }
        else
            elChange.SetHasClass('show-change', false);
        reusePanel.SetDialogVariableInt('price', filteredList[nPanelIdx].price);
        reusePanel.FindChildInLayoutFile('id-store-item-rarity').SetImage('file://{images}/icons/ui/sticker_rarity_' + stickerData.rarity + '.svg');
        reusePanel.SwitchClass('rarity', 'rarity-' + stickerData.rarity);
        reusePanel.FindChildInLayoutFile('id-store-item-rarity-bar').style.washColor = InventoryAPI.GetItemRarityColor(stickerData.itemId);
        reusePanel.FindChildInLayoutFile('id-store-item-hot-trend').SetHasClass('show', stickerData.popularityRank < 40);
        reusePanel.SetHasClass('is-player', stickerData.isPlayer);
        const shopItem = { id: stickerData.itemId, name: filteredList[nPanelIdx].displayName, price: filteredList[nPanelIdx].price, oldPrice: filteredList[nPanelIdx].oldPrice };
        ShoppingCart.cart.subscribeToUpdates(reusePanel, 'tile-counter', () => {
            const quantityInCart = ShoppingCart.cart.getItemQuantity(stickerData.itemId);
            reusePanel.SetHasClass('show-quantity', quantityInCart > 0);
            reusePanel.SetDialogVariableInt('quantity', quantityInCart);
        });
        reusePanel.FindChildInLayoutFile('id-store-item-add-to-cart-btn').SetPanelEvent('onactivate', () => {
            ShoppingCart.cart.addItem(shopItem);
            if (ShoppingCart.cart.getItemQuantity(stickerData.itemId) >= 10 || ShoppingCart.cart.getTotalItems() >= 100) {
                $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.buymenu_failure', 'MOUSE');
                return;
            }
            $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.generic_button_press', 'MOUSE');
        });
        reusePanel.FindChildInLayoutFile('id-store-item-remove-from-cart-btn').SetPanelEvent('onactivate', () => {
            ShoppingCart.cart.decrementItem(shopItem.id);
            $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.generic_button_press', 'MOUSE');
        });
        const elBookmark = reusePanel.FindChildInLayoutFile('id-store-item-bookmark');
        elBookmark.checked = _IsItemBookmarked(stickerData.rawId);
        elBookmark.SetPanelEvent('onactivate', () => {
            _UpdateBookmarkSetting(cp, reusePanel, stickerData.rawId);
        });
        reusePanel.FindChildInLayoutFile('id-store-item-image').itemid = stickerData.itemId;
        reusePanel.FindChildInLayoutFile('id-store-item-team-logo').SetImage(stickerData.isOrg ?
            'file://{images}/tournaments/events/tournament_logo_' + g_ActiveTournamentInfo.eventid + '.svg' :
            'file://{images}/tournaments/teams/' + filteredList[nPanelIdx].teamTag + '.svg');
        const MapPanel = reusePanel.FindChildInLayoutFile('id-store-item-model');
        MapPanel.SetCamera('camera_weapon_7');
        MapPanel.SetActiveItem(0);
        MapPanel.SetItemItemId(stickerData.itemId, '');
        MapPanel.SetRotationLimits(60, 45);
        MapPanel.SetAutoRotateAmount(20, -2);
        MapPanel.SetAutoRotatePeriod(6, 6);
        let nRenderInterval = 1;
        MapPanel.SetRenderInterval(nRenderInterval);
        reusePanel.FindChildInLayoutFile('id-inspect-sticker').SetPanelEvent('onactivate', () => {
            _OpenFullscreenInspect(cp, stickerData);
        });
    }
    function _OpenFullscreenInspect(cp, stickerData) {
        function _Callback() {
            _UpdateVisiblePanel(cp);
        }
        ;
        const callback = UiToolkitAPI.RegisterJSCallback(_Callback);
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
        let oSettings = {
            item_id: stickerData.itemId,
            inspect_only: true,
            hide_all_action_items: true,
            price_in_tokens: stickerData.price,
            sticker_def_index: stickerData.rawId,
            callback_handle: callback
        };
        elPanel.Data().oSettings = oSettings;
    }
    function _GetFilteredSortedIds(cp) {
        let aFilteredStickers = [];
        let bNoFilter = true;
        const FilterSortSettings = _UpdateFilterSettings(cp);
        const elSearchBox = cp.FindChildInLayoutFile('id-major-store-search-box');
        if (elSearchBox.text) {
            aFilteredStickers = _GetItemsForSearch(cp, elSearchBox.text);
            bNoFilter = false;
        }
        else if (cp.Data().useBookMarkList) {
            aFilteredStickers = _GetBookmarkedItemsList(cp);
        }
        else
            aFilteredStickers = cp.Data().aFlatStickersData;
        if (FilterSortSettings.selectedTeamIds.length > 0) {
            bNoFilter = false;
            aFilteredStickers = aFilteredStickers.filter(sticker => FilterSortSettings.selectedTeamIds.includes(sticker.teamId));
        }
        if (FilterSortSettings.playersOnly || FilterSortSettings.teamsOnly) {
            bNoFilter = false;
            aFilteredStickers = aFilteredStickers.filter(sticker => (sticker.isPlayer && FilterSortSettings.playersOnly) ||
                (!sticker.isPlayer && FilterSortSettings.teamsOnly));
        }
        if (FilterSortSettings.rarity.length > 0) {
            bNoFilter = false;
            aFilteredStickers = aFilteredStickers.filter(sticker => FilterSortSettings.rarity.includes(sticker.rarity));
        }
        cp.FindChildInLayoutFile('id-major-store-content').SetHasClass('no-filters', bNoFilter);
        if (FilterSortSettings.sort !== 'default') {
            const nSortDirection = ((FilterSortSettings.sortDirection === 'asc') ? 1 : -1);
            const filterSetting = FilterSortSettings.sort;
            return [...aFilteredStickers].sort((a, b) => {
                let aField = a[filterSetting];
                let bField = b[filterSetting];
                if (filterSetting === 'name') {
                    aField = aField.toLowerCase();
                    bField = bField.toLowerCase();
                }
                if (aField != bField)
                    return ((aField < bField) ? -1 : 1) * nSortDirection;
                if (a.popularity != b.popularity)
                    return b.popularity - a.popularity;
                else if (a.price != b.price)
                    return b.price - a.price;
                else
                    return a.rawId - b.rawId;
            });
        }
        ;
        return aFilteredStickers;
    }
    function _GetFilteredTeams(cp) {
        const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
        let elTeams = elFilterPanel.FindChildInLayoutFile('id-major-store-filter-section-teams');
        return [...elTeams.Children().filter(panel => panel.checked)];
    }
    function _GetFilteredRarities(cp) {
        const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
        let elRarities = elFilterPanel.FindChildInLayoutFile('id-major-store-filter-rarities');
        return elRarities.Children().filter(panel => panel.checked);
    }
    function _SetUpFilterPanel(cp) {
        const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
        g_ActiveTournamentTeams.forEach((team, i) => {
            const elParent = elFilterPanel.FindChildInLayoutFile('id-major-store-filter-section-teams');
            let elTeam = elParent.FindChildInLayoutFile(g_ActiveTournamentTeams[i].team);
            if (!elTeam) {
                elTeam = $.CreatePanel('ToggleButton', elParent, g_ActiveTournamentTeams[i].team);
                elTeam.BLoadLayoutSnippet('filter-team-btn');
                elTeam.Data().team = g_ActiveTournamentTeams[i].team;
                elTeam.Data().teamid = g_ActiveTournamentTeams[i].teamid;
                elTeam.SetAttributeString('filter-button', 'true');
                elTeam.SetPanelEvent('onactivate', () => {
                    _UpdateItemsList(cp);
                });
                elTeam.FindChildInLayoutFile('id-filter-icon').SetImage('file://{images}/tournaments/teams/' + g_ActiveTournamentTeams[i].team + '.svg');
                elTeam.FindChildInLayoutFile('id-filter-icon-blur').SetImage('file://{images}/tournaments/teams/' + g_ActiveTournamentTeams[i].team + '.svg');
            }
        });
        const aRarities = [3, 4, 5, 6];
        aRarities.forEach((r, index) => {
            const rarityBtn = elFilterPanel.FindChildInLayoutFile('id-major-store-filter-rarity-' + r);
            if (rarityBtn) {
                rarityBtn.SetDialogVariable('rarity', $.Localize('#major_store_filter_type_' + r));
                rarityBtn.FindChildInLayoutFile('id-filter-icon').SetImage('file://{images}/icons/ui/sticker_rarity_' + r + '.svg');
                rarityBtn.FindChildInLayoutFile('id-filter-icon-blur').SetImage('file://{images}/icons/ui/sticker_rarity_' + r + '.svg');
                rarityBtn.Data().rarity = r;
                rarityBtn.SetPanelEvent('onactivate', () => {
                    _UpdateItemsList(cp);
                });
            }
        });
        elFilterPanel.FindChildInLayoutFile('id-major-store-filter-team').SetPanelEvent('onactivate', () => {
            _UpdateItemsList(cp);
        });
        elFilterPanel.FindChildInLayoutFile('id-major-store-filter-player').SetPanelEvent('onactivate', () => {
            _UpdateItemsList(cp);
        });
        const elClearBtn = elFilterPanel.FindChildInLayoutFile('id-major-store-filters-clear');
        elClearBtn.SetDialogVariable('name', $.Localize('#major_store_filter_type_clear_all'));
        elClearBtn.SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp, false, cp.Data().useBookMarkList);
            _UpdateItemsList(cp);
        });
        const elClearAllNavBtn = cp.FindChildInLayoutFile('id-filter-active-clear_all');
        elClearAllNavBtn.SetDialogVariable('name', $.Localize('#major_store_filter_type_clear_all'));
        elClearAllNavBtn.AddClass('clear-all');
        elClearAllNavBtn.visible = false;
        elClearAllNavBtn.SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp, false, cp.Data().useBookMarkList);
            _UpdateItemsList(cp);
            elClearAllNavBtn.visible = false;
        });
    }
    function _Debounce(cp, handleName, delay, fnAction) {
        if (cp.Data()[handleName]) {
            $.CancelScheduled(cp.Data()[handleName]);
            cp.Data()[handleName] = null;
        }
        cp.Data()[handleName] = $.Schedule(delay, fnAction);
    }
    function _GetItemsForSearch(cp, searchTxt) {
        const tokens = searchTxt.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
        if (tokens.length === 0)
            return [];
        const items = cp.Data().aFlatStickersData;
        return items
            .map(item => {
            let totalScore = 0;
            const lowerTokens = tokens.map(t => t.toLowerCase());
            const hasMatch = lowerTokens.every(token => {
                let tokenScore = 0;
                const nick = item.playerCode.toLowerCase();
                const tag = (item.teamTag) ? item.teamTag.toLowerCase() : '';
                const rarity = item.rarityLookup.toLowerCase();
                const team = (item.teamName) ? item.teamName.toLowerCase() : '';
                const real = (item.realName) ? item.realName.toLowerCase() : '';
                if (nick === token || nick.startsWith(token))
                    tokenScore = 100;
                else if (nick.includes(token))
                    tokenScore = 80;
                else if (tag.includes(token))
                    tokenScore = 60;
                else if (rarity.includes(token))
                    tokenScore = 40;
                else if (team.includes(token) || real.includes(token))
                    tokenScore = 20;
                totalScore += tokenScore;
                return tokenScore > 0;
            });
            return { item, score: totalScore, isValid: hasMatch };
        })
            .filter(result => result.isValid)
            .sort((a, b) => b.score - a.score)
            .map(result => result.item);
    }
    function _ShowSearchResults(cp, aStickers) {
        const elTextSearchFlyout = cp.FindChildInLayoutFile('id-major-fullscreen-text-search');
        const elResultsPanel = elTextSearchFlyout.FindChildInLayoutFile('id-search-list');
        elResultsPanel.Children().forEach(result => {
            result.DeleteAsync(0);
        });
        if (aStickers.length > 0) {
            _PushOverlay(cp, 'id-major-fullscreen-text-search');
            if (aStickers.length > 1) {
                const elPanel = $.CreatePanel('Button', elResultsPanel, '');
                elPanel.SetDialogVariableInt('results-count', aStickers.length);
                elPanel.BLoadLayoutSnippet('search-result-show-all');
                elPanel.SetPanelEvent('onactivate', () => {
                    _OnActivateClearAll(cp, true);
                    _PopOverlay();
                    if (m_activeMain?.id === 'id-major-store-content')
                        _UpdateItemsList(cp);
                    else
                        _ShowMainPanel(cp, 'id-major-store-content');
                });
            }
            aStickers.forEach(sticker => {
                const elTile = $.CreatePanel('Button', elResultsPanel, '');
                elTile.BLoadLayoutSnippet('search-result');
                elTile.FindChildInLayoutFile('id-result-icon').itemid = sticker.itemId;
                sticker.displayName.SetOnLabel(elTile.FindChildInLayoutFile('id-result-name'));
                elTile.SetDialogVariableInt('price', sticker.price);
                elTile.FindChildInLayoutFile('id-result-inspect').SetPanelEvent('onactivate', () => {
                    _OpenFullscreenInspect(cp, sticker);
                    _PopOverlay();
                });
                const elBookmark = elTile.FindChildInLayoutFile('id-store-item-bookmark');
                elBookmark.checked = _IsItemBookmarked(sticker.rawId);
                elBookmark.SetPanelEvent('onactivate', () => {
                    _UpdateBookmarkSetting(cp, elTile, sticker.rawId);
                });
            });
            return;
        }
        _PopOverlay();
    }
    function OnSearchContextMenuCallBack(msg) {
    }
    function _ShowMainPanel(cp, panelId) {
        let nextPanel = cp.FindChildInLayoutFile(panelId);
        if (!nextPanel || nextPanel === m_activeMain)
            return;
        if (m_activeMain && m_activeMain.IsValid()) {
            if (m_activeMain.id === 'id-major-store-single-view' && panelId !== 'id-major-store-content') {
                nextPanel = cp.FindChildInLayoutFile('id-major-store-team-view');
                nextPanel.RemoveClass('hidden');
                m_activeMain = nextPanel;
            }
            if (panelId == 'id-major-store-banners') {
                _SetUpBookmarkItemsBanner(cp);
                _SetUpPopularityBanner(cp);
            }
            if (panelId == 'id-major-store-content') {
                _MakeDelayedLoadList(cp);
            }
            m_activeMain.AddClass('hidden');
        }
        nextPanel.RemoveClass('hidden');
        m_activeMain = nextPanel;
        _UpdateBackButton(cp);
        $.DispatchEvent('CSGOPlaySoundEffect', 'inventory_inspect_close', 'MOUSE');
    }
    function _UpdateBackButton(cp) {
        const btn = cp.FindChildInLayoutFile('id-popup-major-store-back-btn');
        btn.visible = !('id-major-store-banners' === m_activeMain?.id);
    }
    function _PushOverlay(cp, panelId) {
        const overlay = $.GetContextPanel().FindChildTraverse(panelId);
        if (!overlay || m_overlayStack.includes(overlay))
            return;
        m_overlayStack.push(overlay);
        overlay.RemoveClass('hidden');
    }
    function _PopOverlay() {
        const topOverlay = m_overlayStack.pop();
        if (topOverlay && topOverlay.IsValid()) {
            topOverlay.AddClass('hidden');
            return true;
        }
        return false;
    }
    function OnCancelPressed() {
        if (m_overlayStack.includes($.GetContextPanel().FindChildInLayoutFile('id-major-store-loading'))) {
            return true;
        }
        if (m_overlayStack.length > 0) {
            const topOverlay = m_overlayStack.pop();
            $.GetContextPanel().FindChildTraverse(topOverlay.id).AddClass('hidden');
            return true;
        }
        if (m_activeMain?.IsValid() && m_activeMain && m_activeMain.id !== 'id-major-store-banners') {
            _ShowMainPanel($.GetContextPanel(), 'id-major-store-banners');
            return true;
        }
        ClosePopup();
        return true;
    }
    PopupMajorStore.OnCancelPressed = OnCancelPressed;
    {
        $.RegisterEventHandler('ReadyForDisplay', $.GetContextPanel(), ReadyForDisplay);
        $.RegisterEventHandler('UnreadyForDisplay', $.GetContextPanel(), UnreadyForDisplay);
        $.GetContextPanel().RegisterForReadyEvents(true);
        if ($.GetContextPanel().BReadyForDisplay()) {
            ReadyForDisplay();
        }
    }
})(PopupMajorStore || (PopupMajorStore = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfbWFqb3Jfc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9wb3B1cHMvcG9wdXBfbWFqb3Jfc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxpREFBaUQ7QUFDakQsK0NBQStDO0FBQy9DLGlEQUFpRDtBQUNqRCxtREFBbUQ7QUFDbkQsMkRBQTJEO0FBQzNELGdEQUFnRDtBQUNoRCw4RUFBOEU7QUFDOUUsNEVBQTRFO0FBQzVFLDREQUE0RDtBQUM1RCw2Q0FBNkM7QUFFN0MsSUFBVSxlQUFlLENBMHdEeEI7QUExd0RELFdBQVUsZUFBZTtJQUVyQixNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyx3Q0FBd0MsQ0FBRSxTQUFTLENBQUUsQ0FBQztJQW9DN0YsTUFBTSxlQUFlLEdBQXFDO1FBQ3RELEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVB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QyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3ZDLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztnQkFDbkIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDM0MsTUFBTSxHQUFHLEdBQUcsQ0FBRSxJQUFJLENBQUMsT0FBTyxDQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDL0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxJQUFJLEdBQUcsQ0FBRSxJQUFJLENBQUMsUUFBUSxDQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDbEUsTUFBTSxJQUFJLEdBQUcsQ0FBRSxJQUFJLENBQUMsUUFBUSxDQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFHbEUsSUFBSyxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUUsS0FBSyxDQUFFO29CQUFFLFVBQVUsR0FBRyxHQUFHLENBQUM7cUJBQzdELElBQUssSUFBSSxDQUFDLFFBQVEsQ0FBRSxLQUFLLENBQUU7b0JBQUcsVUFBVSxHQUFHLEVBQUUsQ0FBQztxQkFDOUMsSUFBSyxHQUFHLENBQUMsUUFBUSxDQUFFLEtBQUssQ0FBRTtvQkFBRSxVQUFVLEdBQUcsRUFBRSxDQUFDO3FCQUM1QyxJQUFLLE1BQU0sQ0FBQyxRQUFRLENBQUUsS0FBSyxDQUFFO29CQUFFLFVBQVUsR0FBRyxFQUFFLENBQUM7cUJBQy9DLElBQUssSUFBSSxDQUFDLFFBQVEsQ0FBRSxLQUFLLENBQUUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFFLEtBQUssQ0FBRTtvQkFBRSxV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