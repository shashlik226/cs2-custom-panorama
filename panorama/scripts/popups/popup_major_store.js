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
            }
            else if (m_activeMain?.id === 'id-major-store-content') {
                _UpdateItemsList(cp);
            }
            $.Schedule(1, () => { cp.Data().stopTileUpdate = true; });
            ShoppingCart.cart.syncPrices((itemId) => {
                const item = cp.Data().aFlatStickersData.find(i => i.itemId === itemId);
                return item ? item.price : undefined;
            });
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
    function _UpdateItemsList(cp) {
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
    function _OnActivateClearAll(cp, doNotClearSearch = false) {
        const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
        elFilterPanel.FindChildrenWithAttributeTraverse('filter-button').forEach(btn => btn.checked = false);
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
        reusePanel.FindChildInLayoutFile('id-store-item-image').itemid = stickerData.itemId;
        reusePanel.FindChildInLayoutFile('id-store-item-team-logo').SetImage(stickerData.isOrg ?
            'file://{images}/tournaments/events/tournament_logo_' + g_ActiveTournamentInfo.eventid + '.svg' :
            'file://{images}/tournaments/teams/' + filteredList[nPanelIdx].teamTag + '.svg');
        ShoppingCart.cart.subscribeToUpdates(reusePanel, 'tile-counter', () => {
            const quantityInCart = ShoppingCart.cart.getItemQuantity(stickerData.itemId);
            reusePanel.SetHasClass('show-quantity', quantityInCart > 0);
            reusePanel.SetDialogVariableInt('quantity', quantityInCart);
        });
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
            _OpenFullscreenInspect(stickerData);
        });
    }
    function _OpenFullscreenInspect(stickerData) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
        let oSettings = {
            item_id: stickerData.itemId,
            inspect_only: true,
            hide_all_action_items: true,
            price_in_tokens: stickerData.price
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
        const numTeamsInSection = g_ActiveTournamentTeams.length / 2;
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
            _OnActivateClearAll(cp);
            _UpdateItemsList(cp);
        });
        const elClearAllNavBtn = cp.FindChildInLayoutFile('id-filter-active-clear_all');
        elClearAllNavBtn.SetDialogVariable('name', $.Localize('#major_store_filter_type_clear_all'));
        elClearAllNavBtn.AddClass('clear-all');
        elClearAllNavBtn.visible = false;
        elClearAllNavBtn.SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
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
                elTile.SetPanelEvent('onactivate', () => {
                    _OpenFullscreenInspect(sticker);
                    _PopOverlay();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfbWFqb3Jfc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9wb3B1cHMvcG9wdXBfbWFqb3Jfc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxpREFBaUQ7QUFDakQsK0NBQStDO0FBQy9DLGlEQUFpRDtBQUNqRCxtREFBbUQ7QUFDbkQsMkRBQTJEO0FBQzNELGdEQUFnRDtBQUNoRCw4RUFBOEU7QUFDOUUsNEVBQTRFO0FBQzVFLDREQUE0RDtBQUM1RCw2Q0FBNkM7QUFFN0MsSUFBVSxlQUFlLENBMmxEeEI7QUEzbERELFdBQVUsZUFBZTtJQUVyQixNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyx3Q0FBd0MsQ0FBRSxTQUFTLENBQUUsQ0FBQztJQW9DN0YsTUFBTSxlQUFlLEdBQXFDO1FBQ3RELEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVB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QUFFO1lBQ1QsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO1lBQ25CLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUUsQ0FBQztZQUd2RCxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUN2QyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7Z0JBQ25CLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzNDLE1BQU0sR0FBRyxHQUFHLENBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQy9ELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQy9DLE1BQU0sSUFBSSxHQUFHLENBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xFLE1BQU0sSUFBSSxHQUFHLENBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBR2xFLElBQUssSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFFLEtBQUssQ0FBRTtvQkFBRSxVQUFVLEdBQUcsR0FBRyxDQUFDO3FCQUM3RCxJQUFLLElBQUksQ0FBQyxRQUFRLENBQUUsS0FBSyxDQUFFO29CQUFHLFVBQVUsR0FBRyxFQUFFLENBQUM7cUJBQzlDLElBQUssR0FBRyxDQUFDLFFBQVEsQ0FBRSxLQUFLLENBQUU7b0JBQUUsVUFBVSxHQUFHLEVBQUUsQ0FB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