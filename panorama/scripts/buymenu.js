"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="mock_adapter.ts" />
var BuyMenu;
(function (BuyMenu) {
    let m_oldWeaponItemId;
    let _UpdateCharacter = function (team, weaponItemId, charItemId, bForceRefresh, bResetAgentAngles) {
        if ((weaponItemId == m_oldWeaponItemId) && !bForceRefresh) {
            return;
        }
        let elPreviewPanel = $.GetContextPanel().FindChildTraverse("id-buymenu-agent");
        if (!elPreviewPanel)
            return;
        if (!weaponItemId) {
            weaponItemId = MockAdapter.GetPlayerActiveWeaponItemId(MockAdapter.GetLocalPlayerXuid());
        }
        if (!team) {
            team = MockAdapter.GetPlayerTeamName(MockAdapter.GetLocalPlayerXuid());
        }
        let teamstring = CharacterAnims.NormalizeTeamName(team, true);
        let settings = ItemInfo.GetOrUpdateVanityCharacterSettings(LoadoutAPI.GetItemID(teamstring, 'customplayer'));
        settings.panel = elPreviewPanel;
        settings.team = teamstring;
        settings.cameraPreset = 18;
        settings.weaponItemId = weaponItemId;
        settings.charItemId = charItemId;
        if (settings.charItemId == '0' || settings.charItemId === LoadoutAPI.GetDefaultItem(teamstring, 'customplayer')) {
            settings.modelOverride = MockAdapter.GetPlayerModel(MockAdapter.GetLocalPlayerXuid());
        }
        CharacterAnims.PlayAnimsOnPanel(settings);
        m_oldWeaponItemId = weaponItemId;
    };
    $.RegisterForUnhandledEvent("BuyMenu_UpdateCharacter", _UpdateCharacter);
})(BuyMenu || (BuyMenu = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV5bWVudS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2NvbnRlbnQvY3Nnby9wYW5vcmFtYS9zY3JpcHRzL2J1eW1lbnUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGtDQUFrQztBQUNsQyx3Q0FBd0M7QUFFeEMsSUFBVSxPQUFPLENBd0RoQjtBQXhERCxXQUFVLE9BQU87SUFFYixJQUFJLGlCQUFxQyxDQUFDO0lBRTFDLElBQUksZ0JBQWdCLEdBQUcsVUFBVSxJQUFZLEVBQUUsWUFBb0IsRUFBRSxVQUFrQixFQUFFLGFBQXNCLEVBQUUsaUJBQTBCO1FBRXZJLElBQUssQ0FBRSxZQUFZLElBQUksaUJBQWlCLENBQUUsSUFBSSxDQUFDLGFBQWEsRUFDNUQ7WUFDSSxPQUFPO1NBQ1Y7UUFFRCxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUMsaUJBQWlCLENBQUUsa0JBQWtCLENBQTZCLENBQUM7UUFDNUcsSUFBSyxDQUFDLGNBQWM7WUFDaEIsT0FBTztRQUVYLElBQUssQ0FBQyxZQUFZLEVBQ2xCO1lBQ0ksWUFBWSxHQUFHLFdBQVcsQ0FBQywyQkFBMkIsQ0FBRSxXQUFXLENBQUMsa0JBQWtCLEVBQUUsQ0FBRSxDQUFDO1NBQzlGO1FBRUQsSUFBSyxDQUFDLElBQUksRUFDVjtZQUNJLElBQUksR0FBRyxXQUFXLENBQUMsaUJBQWlCLENBQUUsV0FBVyxDQUFDLGtCQUFrQixFQUFFLENBQUUsQ0FBQztTQUM1RTtRQUdQLElBQUksVUFBVSxHQUFHLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBRSxJQUFJLEVBQUUsSUFBSSxDQUFnQixDQUFDO1FBQzlFLElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxrQ0FBa0MsQ0FBRSxVQUFVLENBQUMsU0FBUyxDQUFFLFVBQVUsRUFBRSxjQUFjLENBQUUsQ0FBRSxDQUFDO1FBRTNHLFFBQVEsQ0FBQyxLQUFLLEdBQUcsY0FBYyxDQUFDO1FBQ2hDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDO1FBQzNCLFFBQVEsQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBQzNCLFFBQVEsQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQ3JDLFFBQVEsQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1FBV2pDLElBQUssUUFBUSxDQUFDLFVBQVUsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLFVBQVUsS0FBSyxVQUFVLENBQUMsY0FBYyxDQUFFLFVBQVUsRUFBRSxjQUFjLENBQUUsRUFDbEg7WUFDSSxRQUFRLENBQUMsYUFBYSxHQUFHLFdBQVcsQ0FBQyxjQUFjLENBQUUsV0FBVyxDQUFDLGtCQUFrQixFQUFFLENBQUcsQ0FBQTtTQUMzRjtRQUVELGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBRSxRQUFRLENBQUUsQ0FBQztRQUU1QyxpQkFBaUIsR0FBRyxZQUFZLENBQUM7SUFFckMsQ0FBQyxDQUFBO0lBRUQsQ0FBQyxDQUFDLHlCQUF5QixDQUFFLHlCQUF5QixFQUFFLGdCQUFnQixDQUFFLENBQUM7QUFDL0UsQ0FBQyxFQXhEUyxPQUFPLEtBQVAsT0FBTyxRQXdEaEIifQ==