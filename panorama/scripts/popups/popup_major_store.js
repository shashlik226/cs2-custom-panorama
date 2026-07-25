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
/// <reference path="../common/unique_random_number.ts"/>
var PopupMajorStore;
(function (PopupMajorStore) {
    const defidxStickerItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('sticker');
    const defidxKeyChainItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('keychain');
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
        cp.Data().aFlatKeyChainData = [];
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_GcLogonNotificationReceived', ReadyForDisplay);
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_UpdateConnectionToGC', ReadyForDisplay);
        $.RegisterForUnhandledEvent('PanoramaComponent_Store_VolatileShopSubscribe', (...args) => { OnVolatileShopSubscribe(...args, cp); });
        _SubscribeForAllTournamentItems();
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
        cp.Data().arrAwaitingPricesheets = [];
        if (!MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, g_ActiveTournamentInfo.stickerids[0])))
            cp.Data().arrAwaitingPricesheets.push(g_ActiveTournamentInfo.itemid_dynamic_stickers);
        let nStickerIdChampion = 0;
        g_ActiveTournamentTeams.forEach((tt) => {
            tt.champions.forEach((tcp) => {
                if (tcp.stickerids.length > 0)
                    nStickerIdChampion = tcp.stickerids[0];
            });
        });
        if (nStickerIdChampion && !MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, nStickerIdChampion)))
            cp.Data().arrAwaitingPricesheets.push(g_ActiveTournamentInfo.itemid_champion_stickers);
        g_ActiveTournamentHighlights.forEach((thg) => {
            if (!MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxKeyChainItem, thg.highlights[0].kc_highlight)))
                cp.Data().arrAwaitingPricesheets.push(thg.itemid_dynamic_shop);
        });
        if (!cp.Data().loadDataTimeoutHandler && (cp.Data().arrAwaitingPricesheets.length > 0)) {
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
        _UpdateKeyChainsData(cp);
        _SetUpTitleBar(cp, eventId);
        _SetUpTeamsBanner(cp);
        _SetUpPopularityBanner(cp);
        _SetUpBookmarkItemsBanner(cp);
        _SetUpOrgBanners(cp);
        _SetUpKeyChainsBanner(cp);
        _SetUpChampionsBanner(cp);
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
        if (cp.Data().loadDataTimeoutHandler) {
            cp.Data().arrAwaitingPricesheets = cp.Data().arrAwaitingPricesheets.filter((xx) => xx != nContainerDef);
            if (cp.Data().arrAwaitingPricesheets.length > 0) {
                return;
            }
            $.CancelScheduled(cp.Data().loadDataTimeoutHandler);
            cp.Data().loadDataTimeoutHandler = null;
            _PopOverlay();
            Init();
            return;
        }
        RefreshSubscription(cp);
        PriceRefreshTimerUpdate(cp);
        if (bNewPricesParsed) {
            if (nContainerDef == g_ActiveTournamentInfo.itemid_dynamic_stickers || nContainerDef == g_ActiveTournamentInfo.itemid_champion_stickers) {
                _UpdateStickerData(cp);
            }
            else if (g_ActiveTournamentDynamicContainers.includes(nContainerDef)) {
                _UpdateKeyChainsData(cp);
            }
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
        else if (m_activeMain?.id === 'id-major-store-keychains') {
            _SetUpKeyChainsPage(cp);
        }
        else if (m_activeMain?.id === 'id-major-store-banners') {
            _SetUpPopularityBanner(cp);
            _SetUpBookmarkItemsBanner(cp);
            _SetUpKeyChainsBanner(cp);
            _SetUpChampionsBanner(cp);
        }
        else if (m_activeMain?.id === 'id-major-store-content') {
            _UpdateItemsList({ cp, bDisableScroll });
        }
    }
    function GetNewMarketPrice(itemId) {
        const item = $.GetContextPanel().Data().aFlatStickersData.find(i => i.itemId === itemId);
        return item ? item.price : undefined;
    }
    PopupMajorStore.GetNewMarketPrice = GetNewMarketPrice;
    function _SubscribeForAllTournamentItems() {
        g_ActiveTournamentDynamicContainers.forEach((id) => StoreAPI.VolatileShopSubscribe(id, true));
    }
    function GetSecondsUntilPendingPriceUpdateForAllTournamentItems() {
        let nSeconds = 0;
        g_ActiveTournamentDynamicContainers.forEach((id) => {
            const nThisPricesheet = StoreAPI.GetSecondsUntilPendingPriceUpdate(id);
            if (nThisPricesheet > 0) {
                if ((nSeconds <= 0) || (nThisPricesheet < nSeconds))
                    nSeconds = nThisPricesheet;
            }
        });
        return nSeconds;
    }
    PopupMajorStore.GetSecondsUntilPendingPriceUpdateForAllTournamentItems = GetSecondsUntilPendingPriceUpdateForAllTournamentItems;
    function RefreshSubscription(cp) {
        if (!cp || !cp.IsValid())
            return;
        CancelRefreshSubscription(cp);
        _SubscribeForAllTournamentItems();
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
        const nSeconds = GetSecondsUntilPendingPriceUpdateForAllTournamentItems();
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
        const MapStickers = MapDataById(cp.Data().aFlatStickersData);
        g_ActiveTournamentTeams.forEach(team => {
            team.stickerids.forEach(id => {
                const oData = {
                    rawId: id,
                    isPlayer: false,
                    isOrg: false,
                    teamId: team.teamid,
                    team: team.team,
                    isChampion: false
                };
                _UpdateWithCurrentData(cp.Data().aFlatStickersData, MapStickers.get(id), oData, _GetStickerData);
            });
            team.players.forEach(player => {
                player.stickerids.forEach(id => {
                    const oData = {
                        rawId: id,
                        isPlayer: true,
                        isOrg: false,
                        teamId: team.teamid,
                        team: team.team,
                        playerCode: player.code,
                        isChampion: false
                    };
                    _UpdateWithCurrentData(cp.Data().aFlatStickersData, MapStickers.get(id), oData, _GetStickerData);
                });
            });
            team.champions.forEach(player => {
                player.stickerids.forEach(id => {
                    const oData = {
                        rawId: id,
                        isPlayer: true,
                        isOrg: false,
                        teamId: team.teamid,
                        team: team.team,
                        playerCode: player.code,
                        isChampion: true
                    };
                    _UpdateWithCurrentData(cp.Data().aFlatStickersData, MapStickers.get(id), oData, _GetStickerData);
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
            _UpdateWithCurrentData(cp.Data().aFlatStickersData, MapStickers.get(id), oData, _GetStickerData);
        });
        const prices = cp.Data().aFlatStickersData.map(i => i.price);
        const min = prices.length ? Math.min(...prices) : 0;
        const max = prices.length ? Math.max(...prices) : 0;
        cp.Data().minPrice = min;
        cp.Data().maxPrice = max;
    }
    function _UpdateKeyChainsData(cp) {
        const highlights = g_ActiveTournamentHighlights;
        const mapKeyChains = MapDataById(cp.Data().aFlatKeyChainData);
        highlights.forEach(group => {
            group.highlights.forEach(kc => {
                const oData = {
                    group_id: group.group_id,
                    itemid_dynamic_shop: group.itemid_dynamic_shop,
                    stage: group.stage,
                    kc_highlight: kc.kc_highlight,
                    teamid1: kc.teamid1,
                    teamid2: kc.teamid2,
                    map_name: kc.map_name,
                    name: kc.title,
                    desc: kc.desc,
                };
                _UpdateWithCurrentData(cp.Data().aFlatKeyChainData, mapKeyChains.get(kc.kc_highlight), oData, _GetKeyChainData);
            });
        });
    }
    function MapDataById(savedFlatData) {
        const oldStickersData = new Map();
        if (savedFlatData && savedFlatData.length > 0) {
            for (let i = 0; i < savedFlatData.length; i++) {
                oldStickersData.set(('rawId' in savedFlatData[i]) ? savedFlatData[i].rawId : savedFlatData[i].kc_highlight, savedFlatData[i]);
            }
        }
        return oldStickersData;
    }
    function _UpdateWithCurrentData(aFlatStoredData, savedItemData, oData, _funcGetData) {
        if (savedItemData) {
            const livePrice = _GetCurrentPriceForItem(savedItemData.itemId);
            if (livePrice !== undefined && savedItemData.price !== undefined) {
                if (savedItemData.price !== livePrice)
                    savedItemData.oldPrice = savedItemData.price;
                savedItemData.price = livePrice;
                savedItemData.popularity = _GetCurrentTrendData(savedItemData.itemId, 'trend');
                const weeklyLow = _GetCurrentTrendData(savedItemData.itemId, 'low');
                const weeklyHigh = _GetCurrentTrendData(savedItemData.itemId, 'high');
                savedItemData.weeklyLow = weeklyLow;
                savedItemData.weeklyHigh = weeklyHigh;
                savedItemData.weeklyPctReductionFromHigh = (weeklyHigh > livePrice)
                    ? ((weeklyHigh - livePrice) * 100.0 / weeklyHigh) : 0.0;
            }
        }
        else {
            aFlatStoredData.push(_funcGetData(oData));
        }
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
            teamRegion: teamRegion,
            champion: oData.isChampion
        };
    }
    function _GetKeyChainData(oData) {
        const itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxKeyChainItem, oData.kc_highlight);
        const livePrice = _GetCurrentPriceForItem(itemId);
        const weeklyLow = _GetCurrentTrendData(itemId, 'low');
        const weeklyHigh = _GetCurrentTrendData(itemId, 'high');
        const weeklyPctReductionFromHigh = (weeklyHigh > livePrice)
            ? ((weeklyHigh - livePrice) * 100.0 / weeklyHigh) : 0.0;
        return {
            group_id: oData.group_id,
            itemid_dynamic_shop: oData.itemid_dynamic_shop,
            kc_highlight: oData.kc_highlight,
            displayName: ItemInfo.GetFormattedName(itemId),
            stage: oData.stage,
            teamid1: oData.teamid1,
            teamid2: oData.teamid2,
            map_name: oData.map_name,
            desc: $.Localize(oData.desc),
            itemId: itemId,
            price: livePrice,
            name: $.Localize(oData.name),
            popularity: _GetCurrentTrendData(itemId, 'trend'),
            weeklyLow: weeklyLow,
            weeklyHigh: weeklyHigh,
            weeklyPctReductionFromHigh: weeklyPctReductionFromHigh
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
            _UpdateItemsList({ cp });
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
            cp.Data().useBookMarkList = false;
            _ShowMainPanel(cp, 'id-major-store-content');
            const elDropDown = cp.FindChildInLayoutFile('id-major-store-sort-dropdown');
            elDropDown.SetSelected('popularity-high-low');
        });
        cp.FindChildInLayoutFile('id-major-store-see-all-bookmarked-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            cp.Data().useBookMarkList = true;
            _ShowMainPanel(cp, 'id-major-store-content');
        });
        cp.FindChildInLayoutFile('id-major-store-see-all-keychains-btn').SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp);
            _ShowMainPanel(cp, 'id-major-store-keychains');
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
            _UpdateItemsList({ cp });
            return;
        }
        if (lister)
            lister.DeleteAsync(0);
        lister = $.CreatePanel('JSDelayLoadList', cp.FindChildInLayoutFile('id-major-store-content-page'), 'id-major-store-items-lister');
        lister.BLoadLayoutSnippet(snippetType);
        $.Schedule(.15, () => _UpdateItemsList({ cp }));
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
                    elCarouselPage = $.CreatePanel('Panel', elParent, 'id-major-store-carousel-page-' + numPages, { class: 'popup-major-store__banner__popular_page elCarouselPage' });
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
        const itemsMap = new Map();
        for (const sticker of cp.Data().aFlatStickersData) {
            itemsMap.set(sticker.rawId.toString(), sticker);
        }
        for (const keyChain of cp.Data().aFlatKeyChainData) {
            itemsMap.set(keyChain.kc_highlight.toString(), keyChain);
        }
        const aDefIndexes = GameInterfaceAPI.GetSettingString('cl_major_store_watch_list').split(',');
        return aDefIndexes.map(defIndex => itemsMap.get(defIndex)).filter((item) => item !== undefined).reverse();
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
                }
                elPanel.BLoadLayoutSnippet('store-tile');
                if (aSorted[stickerIndex]) {
                    const bIsSticker = 'rawId' in aSorted[stickerIndex];
                    elPanel.SetHasClass('keychain', !bIsSticker);
                    if (bIsSticker)
                        _UpdateTile(cp, elPanel, aSorted, stickerIndex);
                    else
                        _UpdateKeyChainsTile(cp, elPanel, aSorted, stickerIndex);
                    elPanel.SetHasClass('hidden', false);
                    elPanel.enabled = true;
                    elPanel.hittest = true;
                }
                else {
                    elPanel.SetHasClass('keychain', false);
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
            _SetUpKeyChainsBanner(cp);
            _SetUpPopularityBanner(cp);
            _SetUpChampionsBanner(cp);
        }
        if (cp.Data().useBookMarkList) {
            _UpdateItemsList({ cp, bDisableScoll: true });
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
    function _SetUpKeyChainsBanner(cp) {
        const elBanner = cp.FindChildInLayoutFile('id-banner-keychains');
        const elCarouselNav = cp.FindChildInLayoutFile('id-carousel-nav-keychains');
        const aKeyChains = cp.Data().aFlatKeyChainData;
        if (aKeyChains.length <= 1) {
            elBanner.visible = false;
            elCarouselNav.visible = false;
            return;
        }
        const itemsMap = new Map();
        for (const item of aKeyChains) {
            itemsMap.set(item.kc_highlight.toString(), item);
        }
        const randomGen = new UniqueRandomUtils.UniqueRandomGenerator(0, 9);
        let aKeyChainsForBanner = [];
        const numItemsFromEachStage = 9;
        g_ActiveTournamentHighlights.forEach(group => {
            randomGen.reset();
            for (let i = 0; i < numItemsFromEachStage; i++) {
                const numRandom = randomGen.next();
                const keyChain = group.highlights[numRandom];
                aKeyChainsForBanner.push(itemsMap.get(keyChain.kc_highlight.toString()));
            }
        });
        elBanner.visible = true;
        elCarouselNav.visible = true;
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }
        shuffleArray(aKeyChainsForBanner);
        const numToShow = aKeyChainsForBanner.length - 1;
        const elParent = cp.FindChildInLayoutFile('id-major-store-banner-keychains');
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
                let elPanel = elCarouselPage.FindChildInLayoutFile('id-carousel-keychain' + i);
                if (!elPanel) {
                    elPanel = $.CreatePanel('Panel', elCarouselPage, 'id-carousel-keychain' + i);
                    elPanel.BLoadLayoutSnippet('store-tile');
                    elPanel.SetHasClass('keychain', true);
                    elPanel.SetHasClass('keychain-banner', true);
                }
                _UpdateKeyChainsTile(cp, elPanel, aKeyChainsForBanner, i);
            }
        }
    }
    function _SetUpChampionsBanner(cp) {
        const elBanner = cp.FindChildInLayoutFile('id-banner-champions');
        const elCarouselNav = cp.FindChildInLayoutFile('id-carousel-nav-champions');
        const aChamps = cp.Data().aFlatStickersData.toSorted((a, b) => {
            if (a.popularity != b.popularity)
                return b.popularity - a.popularity;
            else if (a.price != b.price)
                return b.price - a.price;
            else
                return a.rawId - b.rawId;
        }).filter(sticker => sticker.champion);
        if (aChamps.length < 1) {
            elBanner.visible = false;
            elCarouselNav.visible = false;
            return;
        }
        elBanner.visible = true;
        elCarouselNav.visible = true;
        const numToShow = aChamps.length;
        const elParent = cp.FindChildInLayoutFile('id-major-store-banner-champions');
        const numTilesPerPage = 8;
        let numPages = 0;
        let elCarouselPage = null;
        for (let i = 0; i < numToShow; i++) {
            if (i % numTilesPerPage === 0) {
                elCarouselPage = elParent.FindChildInLayoutFile('id-major-store-carousel-page-' + numPages);
                if (!elCarouselPage) {
                    elCarouselPage = $.CreatePanel('Panel', elParent, 'id-major-store-carousel-page-' + numPages, { class: 'popup-major-store__banner__popular_page banner-bookmark small' });
                }
                numPages++;
            }
            if (elCarouselPage) {
                let elPanel = elCarouselPage.FindChildInLayoutFile('id-carousel-champs' + i);
                if (!elPanel) {
                    elPanel = $.CreatePanel('Panel', elCarouselPage, 'id-carousel-champs' + i);
                    elPanel.BLoadLayoutSnippet('store-tile');
                }
                _UpdateTile(cp, elPanel, aChamps, i);
            }
        }
    }
    function _SetUpTeamView(cp, team) {
        const elPanel = cp.FindChildInLayoutFile('id-major-store-team-view');
        elPanel.Data().DisplayedTeam = team;
        const teamName = $.Localize('#CSGO_TeamID_' + team.teamid);
        elPanel.SetDialogVariable('team-name', teamName);
        const elTilesContainer = cp.FindChildInLayoutFile('id-major-store-team-tiles');
        const numTiles = 6;
        const randomGen = new UniqueRandomUtils.UniqueRandomGenerator(0, 7);
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
            randomGen.reset();
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
                const zIndex = randomGen.next();
                const rotationSetting = zIndex == 3 ? getRandomInt(-15, 15) : getRandomInt(-95, 85);
                if (idx % 4 === 0) {
                    xpos = 0;
                }
                sticker.style.transform = 'rotateZ(' + rotationSetting + 'deg) translateY(-' + getRandomInt(8, 30) + 'px) translateX(' + getRandomInt(xpos, xpos + 35) + 'px)';
                xpos = xpos + 50;
                sticker.style.zIndex = ((idx === stickers.length - 1) && (stickers[idx].champion)) ? '9;' : zIndex + ';';
                sticker.style.brightness = zIndex === 0 ? '.5' : zIndex === 1 ? '.7' : zIndex === 2 ? '.8' : zIndex === 3 ? '1.1' : '1';
            });
            elStickerContainer.Children().forEach((sticker, index) => { if (index >= stickers.length) {
                sticker.DeleteAsync(0);
            } });
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
        const numTiles = aStickers.length;
        const elParent = elPanel.FindChildInLayoutFile('id-major-store-single-tiles');
        for (let i = 0; i < numTiles; i++) {
            let elPackTile = elParent.FindChildInLayoutFile('sticker-single-' + i);
            if (!elPackTile) {
                elPackTile = $.CreatePanel('ItemImage', elParent, 'sticker-single-' + i);
                elPackTile.BLoadLayoutSnippet('store-tile');
            }
            _UpdateTile(cp, elPackTile, aStickers, i);
        }
        elParent.Children().forEach((sticker, index) => { if (index >= aStickers.length) {
            sticker.DeleteAsync(0);
        } });
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
    function _UpdateItemsList(oSettings) {
        const elParent = oSettings.cp.FindChildInLayoutFile('id-major-store-content-page');
        let elLister = elParent.FindChildInLayoutFile('id-major-store-items-lister');
        if (!elLister)
            return;
        const filteredList = _GetFilteredSortedIds(oSettings);
        elLister.SetLoadListItemFunction((elLister, nPanelIdx, reusePanel) => {
            const bIsSticker = 'rawId' in filteredList[nPanelIdx];
            if (!reusePanel || !reusePanel.IsValid()) {
                reusePanel = $.CreatePanel('Panel', elLister, '');
                reusePanel.BLoadLayoutSnippet('store-tile');
            }
            if (bIsSticker) {
                _UpdateTile(oSettings.cp, reusePanel, filteredList, nPanelIdx);
            }
            else {
                _UpdateKeyChainsTile(oSettings.cp, reusePanel, filteredList, nPanelIdx);
            }
            reusePanel.SetHasClass('keychain', !bIsSticker);
            return reusePanel;
        });
        elLister.UpdateListItems(filteredList.length);
        oSettings.cp.SetDialogVariableInt('item-count', filteredList.length);
        if (!oSettings.bDisableScroll)
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
        if (btnTeamOnly.checked && btnTeamOnly.enabled) {
            numFiltersSelected++;
            _MakeNavBarFilterButton(cp, elNavBarFiltersParent, btnTeamOnly, '#major_store_filter_type_team_only', "id-filter-active-t-only");
        }
        const btnPlayerOnly = cp.FindChildInLayoutFile('id-major-store-filter-player');
        if (btnPlayerOnly.checked && btnPlayerOnly.enabled) {
            numFiltersSelected++;
            _MakeNavBarFilterButton(cp, elNavBarFiltersParent, btnPlayerOnly, '#major_store_filter_type_player_only', "id-filter-active-p-only");
        }
        const btnKeyChainsOnly = cp.FindChildInLayoutFile('id-major-store-filter-keychains').FindChildInLayoutFile('id-slider-btn');
        if (btnKeyChainsOnly.checked && btnKeyChainsOnly.enabled) {
            numFiltersSelected++;
            _MakeNavBarFilterButton(cp, elNavBarFiltersParent, btnKeyChainsOnly, '#major_store_filter_type_keychains_only', "id-filter-active-k-only");
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
                _UpdateItemsList({ cp });
                elActiveFilterBtn.DeleteAsync(0);
            });
        }
        cp.FindChildInLayoutFile('id-filter-active-clear_all').visible = numFiltersSelected > 1;
        cp.FindChildInLayoutFile('id-major-store-filters-clear').visible = numFiltersSelected > 1;
        let sortDirection = 'asc';
        let sortType = elDropDown.GetSelected().id || 'weekly-high-low';
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
        return btnKeyChainsOnly.checked
            ? {
                selectedTeamIds: aTeams.flatMap(team => team.Data().teamid).filter(x => false),
                sort: sortType,
                rarity: aRarities.flatMap(panel => panel.Data().rarity).filter(x => false),
                teamsOnly: false,
                playersOnly: false,
                keyChainsOnly: true,
                sortDirection: sortDirection,
                price: priceFilter,
                searchText: elSearchBox.text
            }
            : {
                selectedTeamIds: aTeams.flatMap(team => team.Data().teamid),
                sort: sortType,
                rarity: aRarities.flatMap(panel => panel.Data().rarity),
                teamsOnly: btnTeamOnly.checked,
                playersOnly: btnPlayerOnly.checked,
                keyChainsOnly: false,
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
            if (elActiveFilterBtn.id === 'id-filter-active-k-only') {
                const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
                elFilterPanel.FindChildrenWithClassTraverse('major-filter-panel__toggle').forEach(btn => {
                    btn.enabled = true;
                });
                const elDropDown = cp.FindChildInLayoutFile('id-major-store-sort-dropdown');
                elDropDown.SetSelected('weekly-high-low');
            }
            _UpdateItemsList({ cp });
            elActiveFilterBtn.DeleteAsync(0);
        });
    }
    function _OnActivateClearAll(cp, doNotClearSearch = false) {
        const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
        elFilterPanel.FindChildInLayoutFile('id-major-store-filter-keychains').FindChildInLayoutFile('id-slider-btn').checked = false;
        elFilterPanel.FindChildrenWithAttributeTraverse('filter-button').forEach(btn => { btn.checked = false, btn.enabled = true; });
        if (!cp.Data().useBookMarkList) {
            cp.Data().useBookMarkList = false;
        }
        if (!doNotClearSearch) {
            _ClearTextSearch(cp);
        }
        const elDropDown = cp.FindChildInLayoutFile('id-major-store-sort-dropdown');
        elDropDown.SetSelected('weekly-high-low');
    }
    function _ClearTextSearch(cp) {
        const elSearchBox = cp.FindChildInLayoutFile('id-major-store-search-box');
        elSearchBox.ClearSelection();
        elSearchBox.text = '';
    }
    function _SetUpKeyChainsPage(cp) {
        cp.Data().aFlatKeyChainData;
        const elParent = cp.FindChildInLayoutFile('id-major-store-keychains');
        const numStages = g_ActiveTournamentHighlights.length;
        for (let i = numStages - 1; i >= 0; --i) {
            const stage = g_ActiveTournamentHighlights[i];
            let elPanel = elParent.FindChildInLayoutFile('id-keychains-stage-' + stage.group_id);
            if (!elPanel) {
                elPanel = $.CreatePanel('Panel', elParent, 'id-keychains-stage-' + stage.group_id);
                elPanel.BLoadLayoutSnippet('keychain-section');
                elPanel.SetDialogVariable('stage-title', $.Localize('#CSGO_Tournament_Event_Stage_' + stage.stage));
            }
            const keyChains = cp.Data().aFlatKeyChainData.filter((keychain) => keychain.stage === stage.stage);
            const elContainer = elPanel.FindChildInLayoutFile('id-keychains-container');
            keyChains.forEach((keychain, idx) => {
                let elTile = elParent.FindChildInLayoutFile('id-keychain-' + keychain.kc_highlight);
                if (!elTile) {
                    elTile = $.CreatePanel('Panel', elContainer, 'id-keychain-' + keychain.kc_highlight);
                    elTile.BLoadLayoutSnippet('store-tile');
                    elTile.SetHasClass('keychain', true);
                    elTile.SetHasClass('keychain-banner', true);
                }
                _UpdateKeyChainsTile(cp, elTile, keyChains, idx);
            });
        }
    }
    function _UpdateTile(cp, reusePanel, filteredList, nPanelIdx) {
        const stickerData = filteredList[nPanelIdx];
        reusePanel.SetDialogVariable('title', stickerData.isPlayer ?
            stickerData.playerCode :
            stickerData.isOrg ?
                g_ActiveTournamentInfo.organization :
                stickerData.teamName);
        _UpdatePriceAnimOnTile(stickerData, reusePanel, cp);
        _SetPriceDataOnTile(stickerData, reusePanel);
        _ShoppingCartControlsOnTile(stickerData, reusePanel);
        _UpdateBookmarkOnTile(stickerData.rawId, reusePanel, cp);
        reusePanel.FindChildInLayoutFile('id-store-item-rarity').SetImage('file://{images}/icons/ui/sticker_rarity_' + stickerData.rarity + '.svg');
        reusePanel.SwitchClass('rarity', 'rarity-' + stickerData.rarity);
        reusePanel.FindChildInLayoutFile('id-store-item-rarity-bar').style.washColor = InventoryAPI.GetItemRarityColor(stickerData.itemId);
        reusePanel.SetHasClass('is-final', false);
        reusePanel.FindChildInLayoutFile('id-store-item-hot-trend').SetHasClass('show', stickerData.popularityRank < 40);
        reusePanel.SetHasClass('is-player', stickerData.isPlayer);
        reusePanel.FindChildInLayoutFile('id-store-item-image').itemid = stickerData.itemId;
        reusePanel.FindChildInLayoutFile('id-store-item-team-logo').SetImage(stickerData.isOrg ?
            'file://{images}/tournaments/events/tournament_logo_' + g_ActiveTournamentInfo.eventid + '.svg' :
            'file://{images}/tournaments/teams/' + stickerData.teamTag + '.svg');
        reusePanel.SetPanelEvent('onmouseover', () => {
            _MakeModelPanel(reusePanel, stickerData.itemId);
        });
        reusePanel.SetPanelEvent('onmouseout', () => {
            _DeleteModelPanel(reusePanel);
        });
        reusePanel.FindChildInLayoutFile('id-inspect-sticker').SetPanelEvent('onactivate', () => {
            _OpenFullscreenInspect(cp, stickerData);
        });
    }
    function _MakeModelPanel(reusePanel, itemId) {
        let elParent = reusePanel.FindChildInLayoutFile('id-store-item-image_container');
        let MapPanel = elParent.FindChildInLayoutFile('id-store-item-model');
        if (!MapPanel) {
            MapPanel = $.CreatePanel('MapItemPreviewPanel', elParent, 'id-store-item-model', {
                class: 'major-store__item-tile__model',
                "require-composition-layer": "true",
                'transparent-background': true,
                'disable-depth-of-field': true,
                player: "false",
                map: "ui/xpshop_item",
                initial_entity: 'item',
                active_item_idx: 0,
                camera: 'camera_weapon_7',
                mouse_rotate: "false",
                auto_recenter: true,
                tabindex: "auto",
                selectionpos: "auto",
                hittest: "true",
                hide_while_waiting_for_composite_materials: "false"
            });
            MapPanel.SetItemItemId(itemId, '');
            MapPanel.SetRotationLimits(60, 45);
            MapPanel.SetAutoRotateAmount(20, -2);
            MapPanel.SetAutoRotatePeriod(6, 6);
            let nRenderInterval = 1;
            MapPanel.SetRenderInterval(nRenderInterval);
        }
    }
    function _DeleteModelPanel(reusePanel) {
        let MapPanel = reusePanel.FindChildInLayoutFile('id-store-item-model');
        if (MapPanel !== null && MapPanel.IsValid()) {
            MapPanel.DeleteAsync(0);
        }
    }
    function _UpdateKeyChainsTile(cp, reusePanel, filteredList, nPanelIdx) {
        const keychainData = filteredList[nPanelIdx];
        reusePanel.SetDialogVariable('title', keychainData.name);
        _UpdatePriceAnimOnTile(keychainData, reusePanel, cp);
        _SetPriceDataOnTile(keychainData, reusePanel);
        _ShoppingCartControlsOnTile(keychainData, reusePanel);
        _UpdateBookmarkOnTile(keychainData.kc_highlight, reusePanel, cp);
        reusePanel.FindChildInLayoutFile('id-store-item-hot-trend').SetHasClass('show', false);
        reusePanel.SetHasClass('is-player', false);
        reusePanel.SetHasClass('is-final', keychainData.stage === 97);
        reusePanel.SetDialogVariable('stage', $.Localize('#CSGO_Tournament_Event_Stage_' + keychainData.stage));
        reusePanel.FindChildInLayoutFile('id-store-item-image').itemid = keychainData.itemId;
        reusePanel.FindChildInLayoutFile('id-store-item-team-1').SetImage('file://{images}/tournaments/teams/' + PredictionsAPI.GetTeamTag(keychainData.teamid1) + '.svg');
        reusePanel.FindChildInLayoutFile('id-store-item-team-2').SetImage('file://{images}/tournaments/teams/' + PredictionsAPI.GetTeamTag(keychainData.teamid2) + '.svg');
        reusePanel.FindChildInLayoutFile('id-store-item-team-bg-1').SetImage('file://{images}/tournaments/teams/' + PredictionsAPI.GetTeamTag(keychainData.teamid1) + '.svg');
        reusePanel.FindChildInLayoutFile('id-store-item-team-bg-2').SetImage('file://{images}/tournaments/teams/' + PredictionsAPI.GetTeamTag(keychainData.teamid2) + '.svg');
        reusePanel.SetPanelEvent('onmouseover', () => {
            if (jsTooltipDelayHandle) {
                $.CancelScheduled(jsTooltipDelayHandle);
                jsTooltipDelayHandle = null;
            }
            jsTooltipDelayHandle = $.Schedule(.4, () => {
                {
                    _ShowVideoClip(reusePanel, keychainData.itemId);
                }
            });
        });
        reusePanel.SetPanelEvent('onmouseout', () => {
            if (jsTooltipDelayHandle) {
                $.CancelScheduled(jsTooltipDelayHandle);
                jsTooltipDelayHandle = null;
            }
            _HideVideoClip(reusePanel, keychainData.itemId);
        });
        reusePanel.FindChildInLayoutFile('id-inspect-sticker').SetPanelEvent('onactivate', () => {
            _OpenFullscreenInspect(cp, keychainData);
        });
    }
    let jsTooltipDelayHandle = null;
    function _ShowVideoClip(elPanel, itemId) {
        const reelId = InventoryAPI.GetItemAttributeValue(itemId, '{uint32}keychain slot 0 highlight');
        if (reelId) {
            const reelJson = InventoryAPI.BuildHighlightReelSchemaJSON(reelId);
            const reelSchemaDef = JSON.parse(reelJson);
            const videoPlayerContainer = elPanel.FindChildTraverse('id-store-item-movie-container');
            const videoPlayer = elPanel.FindChildTraverse('id-store-item-movie');
            if (videoPlayerContainer && videoPlayer) {
                videoPlayerContainer.AddClass('play');
                videoPlayer.AddClass('play');
                videoPlayer.SetMovie(reelSchemaDef["url_480p"]);
                videoPlayer.Play();
            }
        }
    }
    function _HideVideoClip(elPanel, itemId) {
        if (InventoryAPI.GetItemAttributeValue(itemId, '{uint32}keychain slot 0 highlight')) {
            const videoPlayerContainer = elPanel.FindChildTraverse('id-store-item-movie-container');
            const videoPlayer = elPanel.FindChildTraverse('id-store-item-movie');
            if (videoPlayerContainer && videoPlayer) {
                videoPlayerContainer.RemoveClass('play');
                videoPlayer.RemoveClass('play');
                videoPlayer.Stop();
            }
        }
    }
    function _UpdatePriceAnimOnTile(stickerData, reusePanel, cp) {
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
    }
    function _SetPriceDataOnTile(stickerData, reusePanel) {
        reusePanel.SetDialogVariableInt('price', stickerData.price);
        reusePanel.SetDialogVariableInt('weeklyLow', stickerData.weeklyLow);
        reusePanel.SetDialogVariableInt('weeklyHigh', stickerData.weeklyHigh);
        let posDot = (stickerData.weeklyHigh > stickerData.weeklyLow)
            ? ((stickerData.price - stickerData.weeklyLow) / (stickerData.weeklyHigh - stickerData.weeklyLow)) * 100
            : 100;
        posDot = Math.floor(Math.max(0, Math.min(96, posDot)));
        reusePanel.FindChildInLayoutFile('id-store-item-price-pos').style.transform = 'translateX(' + posDot + '%)';
    }
    function _ShoppingCartControlsOnTile(stickerData, reusePanel) {
        const shopItem = { id: stickerData.itemId, name: stickerData.displayName, price: stickerData.price, oldPrice: stickerData.oldPrice };
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
    }
    function _UpdateBookmarkOnTile(defidx, reusePanel, cp) {
        const elBookmark = reusePanel.FindChildInLayoutFile('id-store-item-bookmark');
        elBookmark.checked = _IsItemBookmarked(defidx);
        elBookmark.SetPanelEvent('onactivate', () => {
            _UpdateBookmarkSetting(cp, reusePanel, defidx);
        });
    }
    function _OpenFullscreenInspect(cp, itemData) {
        function _Callback() {
            _UpdateVisiblePanel(cp);
        }
        ;
        const callback = UiToolkitAPI.RegisterJSCallback(_Callback);
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
        let oSettings = {
            item_id: itemData.itemId,
            inspect_only: true,
            hide_all_action_items: true,
            price_in_tokens: itemData.price,
            sticker_def_index: 'rawId' in itemData ? itemData.rawId : itemData.kc_highlight,
            callback_handle: callback
        };
        elPanel.Data().oSettings = oSettings;
    }
    function _GetFilteredSortedIds(oSettings) {
        let aFilteredStickers;
        let bNoFilter = true;
        const cp = oSettings.cp;
        const FilterSortSettings = _UpdateFilterSettings(cp);
        const btnKeyChainsToggle = cp.FindChildInLayoutFile('id-major-store-filter-keychains').FindChildInLayoutFile('id-slider-btn');
        const elSearchBox = cp.FindChildInLayoutFile('id-major-store-search-box');
        if (elSearchBox.text) {
            const searchResults = _GetItemsForSearch(cp, elSearchBox.text);
            aFilteredStickers = btnKeyChainsToggle.checked ? searchResults.keychainResults : searchResults.stickerResults;
            bNoFilter = false;
        }
        else if (cp.Data().useBookMarkList) {
            aFilteredStickers = _GetBookmarkedItemsList(cp);
        }
        else {
            aFilteredStickers = aFilteredStickers = btnKeyChainsToggle.checked ? cp.Data().aFlatKeyChainData : cp.Data().aFlatStickersData;
        }
        if (FilterSortSettings.selectedTeamIds.length > 0) {
            bNoFilter = false;
            aFilteredStickers = aFilteredStickers.filter(sticker => FilterSortSettings.selectedTeamIds.includes(sticker.teamId));
        }
        if (FilterSortSettings.playersOnly || FilterSortSettings.teamsOnly || FilterSortSettings.keyChainsOnly) {
            bNoFilter = false;
            aFilteredStickers = aFilteredStickers.filter(sticker => (('kc_highlight' in sticker) && FilterSortSettings.keyChainsOnly) ||
                (!('kc_highlight' in sticker) && sticker.isPlayer && FilterSortSettings.playersOnly) ||
                (!('kc_highlight' in sticker) && !sticker.isPlayer && FilterSortSettings.teamsOnly));
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
        return [...elTeams.Children().filter(panel => panel.checked && panel.enabled)];
    }
    function _GetFilteredRarities(cp) {
        const elFilterPanel = cp.FindChildInLayoutFile('id-major-store-filters-panel');
        let elRarities = elFilterPanel.FindChildInLayoutFile('id-major-store-filter-rarities');
        return elRarities.Children().filter(panel => panel.checked && panel.enabled);
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
                    _UpdateItemsList({ cp });
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
                    _UpdateItemsList({ cp });
                });
            }
        });
        elFilterPanel.FindChildInLayoutFile('id-major-store-filter-team').SetPanelEvent('onactivate', () => {
            _UpdateItemsList({ cp });
        });
        elFilterPanel.FindChildInLayoutFile('id-major-store-filter-player').SetPanelEvent('onactivate', () => {
            _UpdateItemsList({ cp });
        });
        const btnKeyChainsOnly = elFilterPanel.FindChildInLayoutFile('id-major-store-filter-keychains').FindChildInLayoutFile('id-slider-btn');
        btnKeyChainsOnly.SetDialogVariable('slide_toggle_text', $.Localize('#major_store_filter_info_keychains'));
        btnKeyChainsOnly.SetPanelEvent('onactivate', () => {
            _EnableDisableFilterPanelBtns(cp, btnKeyChainsOnly.checked);
            _UpdateItemsList({ cp });
        });
        const elClearBtn = elFilterPanel.FindChildInLayoutFile('id-major-store-filters-clear');
        elClearBtn.SetDialogVariable('name', $.Localize('#major_store_filter_type_clear_all'));
        elClearBtn.SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp, false);
            _UpdateItemsList({ cp });
        });
        const elClearAllNavBtn = cp.FindChildInLayoutFile('id-filter-active-clear_all');
        elClearAllNavBtn.SetDialogVariable('name', $.Localize('#major_store_filter_type_clear_all'));
        elClearAllNavBtn.AddClass('clear-all');
        elClearAllNavBtn.visible = false;
        elClearAllNavBtn.SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp, false);
            _UpdateItemsList({ cp });
            elClearAllNavBtn.visible = false;
        });
    }
    function _EnableDisableFilterPanelBtns(cp, btnKeyChainsOnly) {
        cp.FindChildrenWithClassTraverse('major-filter-panel__toggle').forEach(btn => {
            btn.enabled = !btnKeyChainsOnly;
        });
        const elDropDown = cp.FindChildInLayoutFile('id-major-store-sort-dropdown');
        elDropDown.SetSelected('weekly-high-low');
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
        let stickerResults = [];
        let keychainResults = [];
        if (tokens.length === 0)
            return { stickerResults, keychainResults };
        const stickers = cp.Data().aFlatStickersData;
        const keychains = cp.Data().aFlatKeyChainData;
        const lowerTokens = tokens.map(t => t.toLowerCase());
        stickerResults = stickers.map(sticker => {
            let totalScore = 0;
            const hasMatch = lowerTokens.every(token => {
                let tokenScore = 0;
                const nick = sticker.playerCode.toLowerCase();
                const tag = (sticker.teamTag) ? sticker.teamTag.toLowerCase() : '';
                const rarity = sticker.rarityLookup.toLowerCase();
                const team = (sticker.teamName) ? sticker.teamName.toLowerCase() : '';
                const real = (sticker.realName) ? sticker.realName.toLowerCase() : '';
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
            return { sticker, score: totalScore, isValid: hasMatch };
        })
            .filter(result => result.isValid)
            .sort((a, b) => b.score - a.score)
            .map(result => result.sticker);
        keychainResults = keychains.map(item => {
            let totalScore = 0;
            const hasMatch = lowerTokens.every(token => {
                let tokenScore = 0;
                const name = item.name ? item.name.toLowerCase() : '';
                const stage = item.stage ? $.Localize('#CSGO_Tournament_Event_Stage_' + item.stage).toLowerCase() : '';
                const team1 = item.teamid1 ? $.Localize('#CSGO_TeamID_' + item.teamid1).toLowerCase() : '';
                const team2 = item.teamid2 ? $.Localize('#CSGO_TeamID_' + item.teamid2).toLowerCase() : '';
                const mapName = item.map_name ? item.map_name.toLowerCase() : '';
                if (name === token || name.startsWith(token))
                    tokenScore = 100;
                else if (name.includes(token))
                    tokenScore = 80;
                else if (mapName.includes(token))
                    tokenScore = 60;
                else if (stage.includes(token))
                    tokenScore = 40;
                else if (team1.includes(token) || team2.includes(token))
                    tokenScore = 20;
                totalScore += tokenScore;
                return tokenScore > 0;
            });
            return { item, score: totalScore, isValid: hasMatch };
        })
            .filter(result => result.isValid)
            .sort((a, b) => b.score - a.score)
            .map(result => result.item);
        return { stickerResults, keychainResults };
    }
    function _ShowSearchResults(cp, oItems) {
        const elTextSearchFlyout = cp.FindChildInLayoutFile('id-major-fullscreen-text-search');
        const elResultsPanel = elTextSearchFlyout.FindChildInLayoutFile('id-search-list');
        elResultsPanel.Children().forEach(result => {
            result.DeleteAsync(0);
        });
        if (oItems.stickerResults.length < 1 && oItems.keychainResults.length < 1) {
            _PopOverlay();
            return;
        }
        cp.Data().useBookMarkList = false;
        _PushOverlay(cp, 'id-major-fullscreen-text-search');
        if (oItems.stickerResults.length > 0) {
            const elSection = $.CreatePanel('Panel', elResultsPanel, 'id-results-stickers', { class: 'major-search-results__section' });
            if (oItems.stickerResults.length > 1) {
                _MakeShowSearchResultsBtn(cp, elSection, oItems.stickerResults.length);
            }
            const elListParent = $.CreatePanel('Panel', elSection, '', { class: 'major-search-results__list' });
            oItems.stickerResults.forEach(item => {
                _MakeSearchTile(cp, elListParent, item);
            });
        }
        if (oItems.stickerResults.length > 0 && oItems.keychainResults.length > 0)
            $.CreatePanel('Panel', elResultsPanel, '', { class: 'major-search-results__section__separator' });
        if (oItems.keychainResults.length > 0) {
            const elSection = $.CreatePanel('Panel', elResultsPanel, 'id-results-keychains', { class: 'major-search-results__section' });
            if (oItems.keychainResults.length > 1) {
                _MakeShowSearchResultsBtn(cp, elSection, oItems.keychainResults.length);
            }
            const elListParent = $.CreatePanel('Panel', elSection, '', { class: 'major-search-results__list' });
            oItems.keychainResults.forEach(item => {
                _MakeSearchTile(cp, elListParent, item);
            });
        }
    }
    function _MakeShowSearchResultsBtn(cp, elSection, count) {
        const elPanel = $.CreatePanel('Button', elSection, '');
        elPanel.SetDialogVariableInt('results-count', count);
        elPanel.BLoadLayoutSnippet('search-result-show-all');
        elPanel.SetDialogVariable('search-text', cp.FindChildInLayoutFile('id-major-store-search-box').text);
        const bIsKeychains = elSection.id !== 'id-results-stickers';
        elPanel.FindChildInLayoutFile('id-results-btn-label').text = $.Localize(bIsKeychains ? '#major_store_search_see_all_keychains' : '#major_store_search_see_all_stickers', elPanel);
        elPanel.SetPanelEvent('onactivate', () => {
            _OnActivateClearAll(cp, true);
            _PopOverlay();
            cp.FindChildInLayoutFile('id-major-store-filter-keychains').FindChildInLayoutFile('id-slider-btn').checked = bIsKeychains;
            _EnableDisableFilterPanelBtns(cp, bIsKeychains);
            if (m_activeMain?.id === 'id-major-store-content') {
                _UpdateItemsList({ cp });
            }
            else
                _ShowMainPanel(cp, 'id-major-store-content');
        });
    }
    function _MakeSearchTile(cp, elSection, item) {
        const bIsSticker = ('rawId' in item);
        const elTile = $.CreatePanel('Button', elSection, '');
        elTile.BLoadLayoutSnippet('search-result');
        elTile.FindChildInLayoutFile('id-result-icon').itemid = item.itemId;
        item.displayName.SetOnLabel(elTile.FindChildInLayoutFile('id-result-name'));
        elTile.SetDialogVariableInt('price', item.price);
        elTile.FindChildInLayoutFile('id-result-inspect').SetPanelEvent('onactivate', () => {
            _OpenFullscreenInspect(cp, item);
            _PopOverlay();
        });
        const elBookmark = elTile.FindChildInLayoutFile('id-store-item-bookmark');
        elBookmark.checked = _IsItemBookmarked(bIsSticker ? item.rawId : item.kc_highlight);
        elBookmark.SetPanelEvent('onactivate', () => {
            _UpdateBookmarkSetting(cp, elTile, bIsSticker ? item.rawId : item.kc_highlight);
        });
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
            if (panelId == 'id-major-store-keychains') {
                _SetUpKeyChainsPage(cp);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfbWFqb3Jfc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9wb3B1cHMvcG9wdXBfbWFqb3Jfc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxpREFBaUQ7QUFDakQsK0NBQStDO0FBQy9DLGlEQUFpRDtBQUNqRCxtREFBbUQ7QUFDbkQsMkRBQTJEO0FBQzNELGdEQUFnRDtBQUNoRCw4RUFBOEU7QUFDOUUsNEVBQTRFO0FBQzVFLDREQUE0RDtBQUM1RCw2Q0FBNkM7QUFDN0MseURBQXlEO0FBRXpELElBQVUsZUFBZSxDQW1oRnhCO0FBbmhGRCxXQUFVLGVBQWU7SUFFckIsTUFBTSxpQkFBaUIsR0FBRyxZQUFZLENBQUMsd0NBQXdDLENBQUUsU0FBUyxDQUFFLENBQUM7SUFDN0YsTUFBTSxrQkFBa0IsR0FBRyxZQUFZLENBQUMsd0NBQXdDLENBQUUsVUFBVSxDQUFFLENBQUM7SUFvRi9GLE1BQU0sZUFBZSxHQUFxQztRQUN0RCxFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxDQUFDLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN4QixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxDQUFDLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN4QixFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxFQUFFLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN6QixFQUFDLE1BQU0sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUMxQixFQUFDLE1BQU0sRUFBQyxDQUFDLEVBQUUsTUFBTSxFQUFDLElBQUksRUFBRTtRQUN4QixFQUFDLE1BQU0s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