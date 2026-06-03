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
        return MissionsAPI.GetSeasonalOperationFauxItemTrend(g_ActiveTournamentInfo.credits_id, itemId);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfbWFqb3Jfc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9wb3B1cHMvcG9wdXBfbWFqb3Jfc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxpREFBaUQ7QUFDakQsK0NBQStDO0FBQy9DLGlEQUFpRDtBQUNqRCxtREFBbUQ7QUFDbkQsMkRBQTJEO0FBQzNELGdEQUFnRDtBQUNoRCw4RUFBOEU7QUFDOUUsNEVBQTRFO0FBQzVFLDREQUE0RDtBQUM1RCw2Q0FBNkM7QUFFN0MsSUFBVSxlQUFlLENBMHdEeEI7QUExd0RELFdBQVUsZUFBZTtJQUVyQixNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyx3Q0FBd0MsQ0FBRSxTQUFTLENBQUUsQ0FBQztJQW9DN0YsTUFBTSxlQUFlLEdBQXFDO1FBQ3RELEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVB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