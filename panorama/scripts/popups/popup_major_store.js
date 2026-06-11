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
        StoreAPI.VolatileShopSubscribe(g_ActiveTournamentInfo.itemid_dynamic_stickers, true);
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
        StoreAPI.VolatileShopSubscribe(g_ActiveTournamentInfo.itemid_dynamic_stickers, true);
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
                    stickerData.popularity = _GetCurrentTrendData(stickerData.itemId, 'trend');
                    const weeklyLow = _GetCurrentTrendData(stickerData.itemId, 'low');
                    const weeklyHigh = _GetCurrentTrendData(stickerData.itemId, 'high');
                    stickerData.weeklyLow = weeklyLow;
                    stickerData.weeklyHigh = weeklyHigh;
                    stickerData.weeklyPctReductionFromHigh = (weeklyHigh > livePrice)
                        ? ((weeklyHigh - livePrice) * 100.0 / weeklyHigh) : 0.0;
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
        const livePrice = _GetCurrentPriceForItem(itemId);
        const weeklyLow = _GetCurrentTrendData(itemId, 'low');
        const weeklyHigh = _GetCurrentTrendData(itemId, 'high');
        const weeklyPctReductionFromHigh = (weeklyHigh > livePrice)
            ? ((weeklyHigh - livePrice) * 100.0 / weeklyHigh) : 0.0;
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
            price: livePrice,
            rarity: numRarity,
            rarityLookup: $.Localize('#major_store_filter_type_' + numRarity),
            name: InventoryAPI.GetItemName(itemId),
            displayName: ItemInfo.GetFormattedName(itemId),
            popularity: _GetCurrentTrendData(itemId, 'trend'),
            weeklyLow: weeklyLow,
            weeklyHigh: weeklyHigh,
            weeklyPctReductionFromHigh: weeklyPctReductionFromHigh,
            teamRegion: teamRegion
        };
    }
    function _GetCurrentPriceForItem(itemId) {
        return MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, itemId);
    }
    function _GetCurrentTrendData(itemId, szField) {
        return MissionsAPI.GetSeasonalOperationFauxItemTrend(g_ActiveTournamentInfo.credits_id, itemId, szField);
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
            const elDropDown = cp.FindChildInLayoutFile('id-major-store-sort-dropdown');
            elDropDown.SetSelected('weekly-high-low');
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
            case 'weekly-high-low':
                sortDirection = 'desc';
                sortType = 'weeklyPctReductionFromHigh';
                break;
            case 'weekly-low-high':
                sortType = 'weeklyPctReductionFromHigh';
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
        reusePanel.SetDialogVariableInt('weeklyLow', filteredList[nPanelIdx].weeklyLow);
        reusePanel.SetDialogVariableInt('weeklyHigh', filteredList[nPanelIdx].weeklyHigh);
        let posDot = (filteredList[nPanelIdx].weeklyHigh > filteredList[nPanelIdx].weeklyLow)
            ? ((filteredList[nPanelIdx].price - filteredList[nPanelIdx].weeklyLow) / (filteredList[nPanelIdx].weeklyHigh - filteredList[nPanelIdx].weeklyLow)) * 100
            : 100;
        posDot = Math.floor(Math.max(0, Math.min(96, posDot)));
        reusePanel.FindChildInLayoutFile('id-store-item-price-pos').style.transform = 'translateX(' + posDot + '%)';
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
        cp.FindChildInLayoutFile('id-popup-major-store-close-btn').visible = m_activeMain.id == 'id-major-store-banners';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfbWFqb3Jfc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9wb3B1cHMvcG9wdXBfbWFqb3Jfc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxpREFBaUQ7QUFDakQsK0NBQStDO0FBQy9DLGlEQUFpRDtBQUNqRCxtREFBbUQ7QUFDbkQsMkRBQTJEO0FBQzNELGdEQUFnRDtBQUNoRCw4RUFBOEU7QUFDOUUsNEVBQTRFO0FBQzVFLDREQUE0RDtBQUM1RCw2Q0FBNkM7QUFFN0MsSUFBVSxlQUFlLENBd3pEeEI7QUF4ekRELFdBQVUsZUFBZTtJQUVyQixNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyx3Q0FBd0MsQ0FBRSxTQUFTLENBQUUsQ0FBQztJQXVDN0YsTUFBTSxlQUFlLEdBQXFDO1FBQ3RELEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQzFCLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3hCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUMsSUFBSSxFQUFFO1FBQ3pCLEVBQUMsTUFBTSxFQUFDLEVBQUUsRUFBRSxNQUFNLEVB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QUMsV0FBVyxFQUFFLENBQUM7Z0JBQzNDLE1BQU0sR0FBRyxHQUFHLENBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQy9ELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQy9DLE1BQU0sSUFBSSxHQUFHLENBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xFLE1BQU0sSUFBSSxHQUFHLENBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBR2xFLElBQUssSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFFLEtBQUssQ0FBRTtvQkFBRSxVQUFVLEdBQUcsR0FBRyxDQUFDO3FCQUM3RCxJQUFLLElBQUksQ0FBQyxRQUFRLENBQUUsS0FBSyxDQUFFO29CQUFHLFVBQVUsR0FBRyxFQUFFLENBQUM7cUJBQzlDLElBQUssR0FBRyxDQUFDLFFBQVEsQ0FBRSxLQUFLLENBQUU7b0JBQUUsVUFBVSxHQUFHLEVBQUUsQ0FBQztxQkFDNUMsSUFBSyxNQUFNLENBQUMsUUFBUSxDQUFFLEtBQUssQ0FBRTtvQkFBRSxVQUFVLEdBQUcsRUFBRSxDQUFDO3FCQUMvQyxJQUFLLElBQUksQ0FBQyxRQUFRLENBQUUsS0FBSyxDQUFFLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBRSxLQUFLLENBQUU7b0JBQUUsVUFBVSxHQUFHLEVBQUUsQ0FBQztnQkFFNUUsVUFBVSxJQUFJLFVBQVUsQ0FBQztnQkFHekIsT0FBTyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1lBQzFCLENBQUMsQ0FBQyxDQUFD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