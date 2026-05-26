"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="common/licenseutil.ts" />
/// <reference path="generated/items_event_current_generated_store.d.ts" />
/// <reference path="generated/items_event_current_generated_store.ts" />
var MainMenuMajorTile;
(function (MainMenuMajorTile) {
    const _m_cp = $.GetContextPanel();
    function _Init() {
        let bVisible = true;
        if (!MyPersonaAPI.IsConnectedToGC())
            bVisible = false;
        else if (LicenseUtil.GetCurrentLicenseRestrictions())
            bVisible = false;
        else if (!g_ActiveTournamentInfo.active)
            bVisible = false;
        _m_cp.SetHasClass('hidden', !bVisible);
        if (!bVisible)
            return;
        _m_cp.FindChildInLayoutFile('id-btn-open-major-hub').SetPanelEvent('onactivate', OpenMajorHub);
        _m_cp.SetHasClass('major-' + g_ActiveTournamentInfo.eventid.toString(), true);
        _m_cp.FindChildInLayoutFile('id-img-open-major-hub').SetImage('file://{images}/tournaments/backgrounds/pickem_mainmenu_promo_' + g_ActiveTournamentInfo.eventid + '.psd');
        let sRestriction = InventoryAPI.GetDecodeableRestriction("capsule");
        let bHasActualCapsulesForPurchase = false;
        _m_cp.SetHasClass('has-reduction', false);
        let tournamentEventId = NewsAPI.GetActiveTournamentEventID();
        if ((tournamentEventId !== 0)) {
            const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
            const defidxStickerItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('sticker');
            const numSticker = 3;
            for (let i = 0; i < numSticker; i++) {
                const itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, g_ActiveTournamentTeams[getRandomInt(0, g_ActiveTournamentTeams.length - 1)].players[getRandomInt(0, 4)].stickerids[getRandomInt(0, 3)]);
                _m_cp.FindChildInLayoutFile('id-open-major-item-image-' + i).itemid = itemId;
                bHasActualCapsulesForPurchase = true;
            }
            let reduction = '';
            _m_cp.SetHasClass('has-reduction', reduction !== '' && reduction !== undefined);
            _m_cp.FindChildInLayoutFile('id-items-banner').SetDialogVariable('items-text', reduction ? $.Localize('#store_sale') : $.Localize('#mainmenu_major_hub_items'));
        }
        _m_cp.SetDialogVariable('hub-title-bar-caption', $.Localize(bHasActualCapsulesForPurchase ? '#mainmenu_major_hub' : '#mainmenu_major_hub_no_items'));
        _m_cp.SetHasClass('can-sell-items', bHasActualCapsulesForPurchase);
    }
    function OpenMajorHub() {
        UiToolkitAPI.ShowCustomLayoutPopupParameters('id-popup-major-hub', 'file://{resources}/layout/popups/popup_major_hub.xml', 'eventid=' + (g_ActiveTournamentInfo.eventid));
    }
    {
        _Init();
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_GcLogonNotificationReceived', _Init);
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_UpdateConnectionToGC', _Init);
        $.RegisterForUnhandledEvent('PanoramaComponent_Store_PriceSheetChanged', _Init);
    }
})(MainMenuMajorTile || (MainMenuMajorTile = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbm1lbnVfbWFqb3JfdGlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2NvbnRlbnQvY3Nnby9wYW5vcmFtYS9zY3JpcHRzL21haW5tZW51X21ham9yX3RpbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGtDQUFrQztBQUNsQyw4Q0FBOEM7QUFDOUMsMkVBQTJFO0FBQzNFLHlFQUF5RTtBQUV6RSxJQUFVLGlCQUFpQixDQThFMUI7QUE5RUQsV0FBVSxpQkFBaUI7SUFFMUIsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDO0lBRWxDLFNBQVMsS0FBSztRQUViLElBQUksUUFBUSxHQUFZLElBQUksQ0FBQztRQUk3QixJQUFLLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRTtZQUNuQyxRQUFRLEdBQUcsS0FBSyxDQUFDO2FBQ2IsSUFBSyxXQUFXLENBQUMsNkJBQTZCLEVBQUU7WUFDcEQsUUFBUSxHQUFHLEtBQUssQ0FBQzthQUNiLElBQUssQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNO1lBQ3ZDLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFFWixLQUFLLENBQUMsV0FBVyxDQUFFLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBRSxDQUFDO1FBQy9DLElBQUssQ0FBQyxRQUFRO1lBQ2IsT0FBTztRQUVSLEtBQUssQ0FBQyxxQkFBcUIsQ0FBRSx1QkFBdUIsQ0FBRSxDQUFDLGFBQWEsQ0FBRSxZQUFZLEVBQUUsWUFBWSxDQUFFLENBQUM7UUFDbkcsS0FBSyxDQUFDLFdBQVcsQ0FBRSxRQUFRLEdBQUcsc0JBQXNCLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRTlFLEtBQUssQ0FBQyxxQkFBcUIsQ0FBRSx1QkFBdUIsQ0FBYyxDQUFDLFFBQVEsQ0FDM0UsZ0VBQWdFLEdBQUcsc0JBQXNCLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBRSxDQUFDO1FBRzlHLElBQUksWUFB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