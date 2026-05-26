"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="common/licenseutil.ts" />
/// <reference path="common/store_items.ts" />
/// <reference path="popups/popup_acknowledge_item.ts" />
/// <reference path="xpshop_track.ts" />
/// <reference path="itemtile_store.ts" />
/// <reference path="xpshop.ts" />
var MainMenuXpShop;
(function (MainMenuXpShop) {
    const _m_XpShopPanel = $.GetContextPanel();
    const m_passDefName = 'XpShopTicket1';
    const m_passId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(InventoryAPI.GetItemDefinitionIndexFromDefinitionName(m_passDefName), 0);
    let m_collageStarted = false;
    let m_nTrack;
    let m_scheduleHandleRepeatCollage = null;
    function _Init() {
        if (!_ShouldShow()) {
            return;
        }
        $.GetContextPanel().FindChildInLayoutFile('id-btn-open-xpshop').SetPanelEvent('onactivate', () => {
            $.DispatchEvent('MainMenuGoToStore', 'id-store-nav-xpshop');
        });
        _GetXpShopItems();
    }
    function _GetXpShopItems() {
        m_nTrack = MissionsAPI.GetSeasonalOperationXpShopIndex();
        if (!m_nTrack || m_nTrack === 0) {
            _m_XpShopPanel.SetHasClass('hidden', true);
            return;
        }
        _SetUpTracks();
        if (!m_collageStarted) {
            GetItemsForCollage();
            m_collageStarted = true;
        }
        _m_XpShopPanel.SetHasClass('hidden', false);
    }
    function _ShouldShow() {
        if (!MyPersonaAPI.IsConnectedToGC()) {
            _m_XpShopPanel.SetHasClass('hidden', true);
            return false;
        }
        let restrictions = LicenseUtil.GetCurrentLicenseRestrictions();
        if (restrictions) {
            _m_XpShopPanel.SetHasClass('hidden', true);
            return false;
        }
        return true;
    }
    function _SetUpTracks() {
        let bHasPrime = FriendsListAPI.GetFriendPrimeEligible(MyPersonaAPI.GetXuid());
        AcknowledgeItems.GetItemsByType([m_passDefName], true);
        InventoryAPI.SetInventorySortAndFilters('inv_sort_age', false, 'item_definition:' + m_passDefName, '', '');
        let nPass = bHasPrime ? InventoryAPI.GetInventoryCount() : 0;
        let passIndex = 0;
        let oXpShopTrackProgress = InventoryAPI.GetCacheTypeElementJSOByIndex('XpShop', 0);
        const elTracksContainer = $.GetContextPanel().FindChildInLayoutFile('id-tracks-container');
        const elBalance = $.GetContextPanel().FindChildInLayoutFile('id-balance');
        const elUpsell = $.GetContextPanel().FindChildInLayoutFile('id-upsell');
        const elTitle = $.GetContextPanel().FindChildInLayoutFile('id-xpshop-title');
        elTracksContainer.SetDialogVariableInt('max-stars', StoreAPI.GetXpShopMaxTrackLevel());
        const bHasXpShopTracksOrBalance = oXpShopTrackProgress && (oXpShopTrackProgress.xp_tracks.length > 0 || oXpShopTrackProgress.redeemable_balance > 0);
        if (nPass > 0 || bHasXpShopTracksOrBalance) {
            elTracksContainer.visible = true;
            elTitle.visible = true;
            elBalance.visible = false;
            elUpsell.visible = false;
            let numVisiblePassesOrTracks = 0;
            let elParent = $.GetContextPanel().FindChildInLayoutFile('id-tracks');
            for (let i = 0; i < StoreAPI.GetXpShopMaxTracks(); i++) {
                let elTrack = elParent.FindChildInLayoutFile('id-xpshop_track_' + i);
                if (!elTrack) {
                    elTrack = $.CreatePanel('Panel', elParent, 'id-xpshop_track_' + i);
                    elTrack.BLoadLayoutSnippet('mainmenu-shop-ticket');
                    elTrack.FindChildInLayoutFile('id-mainmenu-xpshop-track-progress').BLoadLayout('file://{resources}/layout/xpshop_track.xml', false, false);
                }
                let elTrackProgress = elTrack.FindChildInLayoutFile('id-mainmenu-xpshop-track-progress');
                let elPass = elTrack.FindChildInLayoutFile('id-mainmenu-xpshop-pass');
                let oSettings;
                if (oXpShopTrackProgress && oXpShopTrackProgress.xp_tracks[i]) {
                    oSettings = {
                        xpshop_track_frame_panel: elTrack,
                        xpshop_track_value: parseInt(oXpShopTrackProgress.xp_tracks[i]),
                    };
                    XpShopTrack.XpShopInit(oSettings);
                    elTrack.visible = true;
                    elTrackProgress.visible = true;
                    elPass.visible = false;
                    ++numVisiblePassesOrTracks;
                }
                else if (nPass > 0 && passIndex < nPass) {
                    passIndex++;
                    oSettings = {
                        xpshop_track_frame_panel: elTrack,
                        xpshop_track_value: 0,
                    };
                    XpShopTrack.XpShopInit(oSettings);
                    elTrackProgress.visible = false;
                    elPass.visible = true;
                    elPass.SetHasClass('small-passes', nPass > 2 ? true : false);
                    elTrack.visible = true;
                    ++numVisiblePassesOrTracks;
                }
                else {
                    elTrack.visible = false;
                }
            }
            if (oXpShopTrackProgress && oXpShopTrackProgress.redeemable_balance !== undefined) {
                elBalance.SetDialogVariableInt('redeemable-points', oXpShopTrackProgress.redeemable_balance);
                elBalance.Data().balance = oXpShopTrackProgress.redeemable_balance;
                elBalance.visible = true;
            }
            if (!numVisiblePassesOrTracks) {
                elUpsell.visible = true;
                elTracksContainer.visible = false;
            }
        }
        else {
            elTracksContainer.visible = false;
            elBalance.visible = false;
            elUpsell.visible = true;
            elTitle.visible = false;
            elUpsell.FindChildInLayoutFile('id-upsell-pass-image').itemid = m_passId;
        }
    }
    let m_tilePreviouslyUpdated = null;
    function GetItemsForCollage() {
        let nCount = MissionsAPI.GetSeasonalOperationRedeemableGoodsCount(m_nTrack);
        let aRedeemableGoods = [];
        let nNewItemCount = 0;
        for (let i = 0; i < nCount; i++) {
            let ShopEntry = {
                item_name: "",
                lootlist: [],
                ui_show_new_tag: ""
            };
            ShopEntry.item_name = MissionsAPI.GetSeasonalOperationRedeemableGoodsSchema(m_nTrack, i, 'item_name');
            ShopEntry.lootlist = _GetLootListForReward(ShopEntry.item_name);
            ShopEntry.ui_show_new_tag = MissionsAPI.GetSeasonalOperationRedeemableGoodsSchema(m_nTrack, i, 'ui_show_new_tag');
            aRedeemableGoods.push(ShopEntry);
            if (XpShop.ShouldShowNewTagForShopEntry(ShopEntry)) {
                nNewItemCount++;
            }
        }
        $.GetContextPanel().SetDialogVariableInt('new-count', nNewItemCount);
        $.GetContextPanel().FindChildInLayoutFile('id-new-item-tag').SetHasClass('hide', nNewItemCount < 1);
        let shuffledArray = aRedeemableGoods.sort((a, b) => 0.5 - Math.random());
        let numImages = 16;
        let longistDelay = numImages * 2;
        let delay = 0;
        let caseShown = false;
        for (let i = 0; i < numImages; i++) {
            let randomGood = shuffledArray[i % nCount];
            if (randomGood.lootlist) {
                let itemid = '';
                if (randomGood.item_name.startsWith('crate_')) {
                    if (!caseShown) {
                        itemid = randomGood.lootlist[0];
                        caseShown = true;
                    }
                    else {
                        let good = shuffledArray[2];
                        if (good.lootlist) {
                            itemid = good.lootlist[randomIntFromInterval(0, randomGood.lootlist.length - 1)];
                        }
                    }
                }
                else {
                    itemid = randomGood.lootlist[randomIntFromInterval(0, randomGood.lootlist.length - 1)];
                }
                if (!m_collageStarted) {
                    $.GetContextPanel().FindChildInLayoutFile('collage-item-' + i).itemid = itemid;
                }
                else {
                    $.Schedule((delay++) * 2, () => {
                        let randomTile = $.GetContextPanel().FindChildInLayoutFile('collage-item-' + randomIntFromInterval(0, numImages - 1));
                        if (randomTile !== m_tilePreviouslyUpdated) {
                            m_tilePreviouslyUpdated = randomTile;
                            randomTile.TriggerClass('update-tile');
                            $.Schedule(1, () => { randomTile.itemid = itemid; });
                        }
                    });
                }
            }
        }
        if (m_scheduleHandleRepeatCollage) {
            $.CancelScheduled(m_scheduleHandleRepeatCollage);
            m_scheduleHandleRepeatCollage = null;
        }
        m_scheduleHandleRepeatCollage = $.Schedule(!m_collageStarted ? 0 : longistDelay, GetItemsForCollage);
    }
    function randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    function _GetLootListForReward(rewardId) {
        if (rewardId.startsWith('crate_')) {
            let nDefinitionIndex = InventoryAPI.GetItemDefinitionIndexFromDefinitionName(rewardId);
            let idCrate = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(nDefinitionIndex, 0);
            return [idCrate];
        }
        var count = InventoryAPI.GetLootListItemsCount(rewardId);
        var itemsList = [];
        if (!count) {
            itemsList.push(rewardId);
        }
        else {
            for (var i = 0; i < count; i++) {
                var itemId = InventoryAPI.GetLootListItemIdByIndex(rewardId, i);
                itemsList.push(itemId);
            }
        }
        return itemsList;
    }
    ;
    function _UpdateTile() {
        if (GameStateAPI.IsLocalPlayerPlayingMatch() || !_ShouldShow()) {
            return;
        }
        _GetXpShopItems();
    }
    {
        _Init();
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_GcLogonNotificationReceived', _Init);
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_UpdateConnectionToGC', _Init);
        $.RegisterForUnhandledEvent('PanoramaComponent_Store_PriceSheetChanged', _Init);
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_InventoryUpdated', _UpdateTile);
        $.RegisterForUnhandledEvent('CSGOShowMainMenu', _UpdateTile);
    }
})(MainMenuXpShop || (MainMenuXpShop = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbm1lbnVfeHBzaG9wX3RpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9tYWlubWVudV94cHNob3BfdGlsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsa0NBQWtDO0FBQ2xDLDhDQUE4QztBQUM5Qyw4Q0FBOEM7QUFDOUMseURBQXlEO0FBQ3pELHdDQUF3QztBQUN4QywwQ0FBMEM7QUFDMUMsa0NBQWtDO0FBRWxDLElBQVUsY0FBYyxDQWlVdkI7QUFqVUQsV0FBVSxjQUFjO0lBRXZCLE1BQU0sY0FBYyxHQUFHLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztJQUMzQyxNQUFNLGFBQWEsR0FBRyxlQUFlLENBQUM7SUFDdEMsTUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLGlDQUFpQyxDQUFFLFlBQVksQ0FBQyx3Q0FBd0MsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUUsQ0FBQztJQUMzSSxJQUFJLGdCQUFnQixHQUFXLEtBQUssQ0FBQztJQUNyQyxJQUFJLFFBQWUsQ0FBQztJQUNwQixJQUFJLDZCQUE2QixHQUFrQixJQUFJLENBQUM7SUFTeEQsU0FBUyxLQUFLO1FBSWIsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUNsQjtZQUNDLE9BQU87U0FDUDtRQUVELENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBRSxvQkFBb0IsQ0FBRSxDQUFDLGFBQWEsQ0FBRSxZQUFZLEVBQUUsR0FBRSxFQUFFO1lBQ2xHLENBQUMsQ0FBQyxhQUFhLENBQUUsbUJBQW1CLEVBQUUscUJBQXFCLENBQUUsQ0FBQztRQUMvRCxDQUFDLENBQUMsQ0FBQztRQUVILGVBQWUsRUFBRSxDQUFDO0lBQ25CLENBQUM7SUFFRCxTQUFTLGVBQWU7UUFFdkIsUUFBUSxHQUFJLFdBQVcsQ0FBQywrQkFBK0IsRUFBRSxDQUFDO1FBQzFELElBQUksQ0FBQyxRQUFRLElBQUksUUFB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