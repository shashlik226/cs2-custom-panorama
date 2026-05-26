"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="avatar.ts" />
/// <reference path="common/sessionutil.ts" />
/// <reference path="mock_adapter.ts" />
/// <reference path="rating_emblem.ts" />
/// <reference path="honor_icon.ts" />
var VanityPlayerInfo;
(function (VanityPlayerInfo) {
    function CreateOrUpdateVanityInfoPanel(elParent = null, oSettings = null) {
        if (!elParent) {
            elParent = $.GetContextPanel();
        }
        const idPrefix = "id-player-vanity-info-" + oSettings.playeridx;
        let newPanel = elParent.FindChildInLayoutFile(idPrefix);
        if (!newPanel) {
            newPanel = $.CreatePanel('Button', elParent, idPrefix);
            newPanel.BLoadLayout('file://{resources}/layout/vanity_player_info.xml', false, false);
            newPanel.AddClass('vanity-info-loc-' + oSettings.playeridx);
            newPanel.AddClass('show');
        }
        _SetName(newPanel, oSettings.xuid);
        _SetAvatar(newPanel, oSettings.xuid);
        _SetRank(newPanel, oSettings.xuid, oSettings.isLocalPlayer);
        _SetSkillGroup(newPanel, oSettings.xuid, oSettings.isLocalPlayer);
        _SetHonorIcon(newPanel, oSettings.xuid);
        _AddOpenPlayerCardAction(newPanel.FindChildInLayoutFile('vanity-info-container'), oSettings.xuid);
        _SetLobbyLeader(newPanel, oSettings.xuid);
        _ShowSettingsBtn(newPanel, oSettings.xuid);
        return newPanel;
    }
    VanityPlayerInfo.CreateOrUpdateVanityInfoPanel = CreateOrUpdateVanityInfoPanel;
    function DeleteVanityInfoPanel(elParent, index) {
        const idPrefix = "id-player-vanity-info-" + index;
        const elPanel = elParent.FindChildInLayoutFile(idPrefix);
        if (elPanel && elPanel.IsValid()) {
            elPanel.DeleteAsync(0);
        }
    }
    VanityPlayerInfo.DeleteVanityInfoPanel = DeleteVanityInfoPanel;
    function _RoundToPixel(context, value, axis) {
        const scale = axis === "x" ? context.actualuiscale_x : context.actualuiscale_y;
        return Math.round(value * scale) / scale;
    }
    function SetVanityInfoPanelPos(elParent, index, oPos, idPrefix, OnlyXOrY) {
        const elPanel = elParent.FindChildInLayoutFile(idPrefix);
        if (elPanel && elPanel.IsValid()) {
            switch (OnlyXOrY) {
                case 'x':
                    elPanel.style.transform = 'translateX( ' + oPos.x + 'px );';
                    break;
                case 'y':
                    elPanel.style.transform = 'translateY( ' + oPos.x + 'px );';
                    break;
                default:
                    elPanel.style.transform = 'translate3d( ' + _RoundToPixel(elParent, oPos.x, "x") + 'px, ' + _RoundToPixel(elParent, oPos.y, "y") + 'px, 0px );';
                    break;
            }
        }
    }
    VanityPlayerInfo.SetVanityInfoPanelPos = SetVanityInfoPanelPos;
    function _SetName(newPanel, xuid) {
        const name = MockAdapter.IsFakePlayer(xuid)
            ? MockAdapter.GetPlayerName(xuid)
            : FriendsListAPI.GetFriendName(xuid);
        newPanel.SetDialogVariable('player_name', name);
    }
    function _SetAvatar(newPanel, xuid) {
        const elParent = newPanel.FindChildInLayoutFile('vanity-avatar-container');
        let elAvatar = elParent.FindChildInLayoutFile('JsPlayerVanityAvatar-' + xuid);
        if (!elAvatar) {
            elAvatar = $.CreatePanel("Panel", elParent, 'JsPlayerVanityAvatar-' + xuid);
            elAvatar.SetAttributeString('xuid', xuid);
            elAvatar.BLoadLayout('file://{resources}/layout/avatar.xml', false, false);
            elAvatar.BLoadLayoutSnippet("AvatarPlayerCard");
            elAvatar.AddClass('avatar--vanity');
        }
        Avatar.Init(elAvatar, xuid, 'partymember');
        if (MockAdapter.IsFakePlayer(xuid)) {
            const elAvatarImage = elAvatar.FindChildInLayoutFile("JsAvatarImage");
            elAvatarImage.PopulateFromPlayerSlot(MockAdapter.GetPlayerSlot(xuid));
        }
    }
    function _SetRank(newPanel, xuid, isLocalPlayer) {
        const elRankIcon = newPanel.FindChildInLayoutFile('vanity-xp-icon');
        const elXpBarInner = newPanel.FindChildInLayoutFile('vanity-xp-bar-inner');
        if (!isLocalPlayer || !MyPersonaAPI.IsInventoryValid()) {
            newPanel.FindChildInLayoutFile('vanity-xp-container').visible = false;
            return;
        }
        newPanel.FindChildInLayoutFile('vanity-xp-container').visible = true;
        const currentLvl = FriendsListAPI.GetFriendLevel(xuid);
        if (!MyPersonaAPI.IsInventoryValid() ||
            !currentLvl ||
            (!_HasXpProgressToFreeze() && !_IsPlayerPrime(xuid))) {
            newPanel.AddClass('no-valid-xp');
            return;
        }
        const bHasRankToFreezeButNoPrestige = (!_IsPlayerPrime(xuid) && _HasXpProgressToFreeze()) ? true : false;
        const currentPoints = FriendsListAPI.GetFriendXp(xuid);
        const pointsPerLevel = MyPersonaAPI.GetXpPerLevel();
        if (bHasRankToFreezeButNoPrestige) {
            elXpBarInner.GetParent().visible = false;
        }
        else {
            const percentComplete = (currentPoints / pointsPerLevel) * 100;
            elXpBarInner.style.width = percentComplete + '%';
            elXpBarInner.GetParent().visible = true;
            _ShowPrestigeUpgrade(newPanel, xuid, isLocalPlayer);
        }
        elRankIcon.SetImage('file://{images}/icons/xp/level' + currentLvl + '.png');
        newPanel.RemoveClass('no-valid-xp');
    }
    function _SetSkillGroup(newPanel, xuid, isLocalPlayer) {
        let rating_type;
        let score;
        let wins;
        if (isLocalPlayer && !PartyListAPI.IsPartySessionActive()) {
            rating_type = 'Premier';
            score = MyPersonaAPI.GetPipRankCount(rating_type);
            wins = MyPersonaAPI.GetPipRankWins(rating_type);
        }
        else {
            rating_type = PartyListAPI.GetFriendCompetitiveRankType(xuid);
            score = PartyListAPI.GetFriendCompetitiveRank(xuid);
            wins = PartyListAPI.GetFriendCompetitiveWins(xuid);
        }
        let options = {
            root_panel: newPanel,
            do_fx: true,
            full_details: false,
            rating_type: rating_type,
            leaderboard_details: { score: score, matchesWon: wins },
            local_player: xuid === MyPersonaAPI.GetXuid()
        };
        RatingEmblem.SetXuid(options);
        newPanel.SetDialogVariable('rating-text', RatingEmblem.GetRatingDesc(newPanel));
    }
    function _SetHonorIcon(elPanel, xuid) {
        const honorIconOptions = {
            honor_icon_frame_panel: elPanel.FindChildTraverse('jsHonorIcon'),
            debug_xuid: xuid,
            do_fx: true,
            xptrail_value: PartyListAPI.GetFriendXpTrailLevel(xuid),
            prime_value: PartyListAPI.GetFriendPrimeEligible(xuid)
        };
        HonorIcon.SetOptions(honorIconOptions);
    }
    function _ShowPrestigeUpgrade(elPanel, xuid, isLocalPlayer) {
        let bPrestigeAvailable = isLocalPlayer && (FriendsListAPI.GetFriendLevel(xuid) >= InventoryAPI.GetMaxLevel());
        elPanel.FindChildInLayoutFile('vanity-xp-prestige').SetHasClass('hidden', !bPrestigeAvailable);
        if (bPrestigeAvailable) {
            elPanel.FindChildInLayoutFile('vanity-xp-prestige').SetPanelEvent('onactivate', _OnActivateGetPrestigeButtonClickable);
        }
    }
    function _OnActivateGetPrestigeButtonClickable() {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
        let oSettings = {
            item_id: '0',
            show_work_type_warning: false,
            work_type: 'prestigecheck'
        };
        elPanel.Data().oSettings = oSettings;
    }
    function UpdateVoiceIcon(elAvatar, xuid) {
        Avatar.UpdateTalkingState(elAvatar, xuid);
    }
    VanityPlayerInfo.UpdateVoiceIcon = UpdateVoiceIcon;
    function _HasXpProgressToFreeze() {
        return MyPersonaAPI.HasPrestige() || (MyPersonaAPI.GetCurrentLevel() > 2);
    }
    function _IsPlayerPrime(xuid) {
        return FriendsListAPI.GetFriendPrimeEligible(xuid);
    }
    function _SetLobbyLeader(elPanel, xuid) {
        elPanel.SetHasClass('is-not-leader', LobbyAPI.GetHostSteamID() !== xuid);
    }
    function _ShowSettingsBtn(elPanel, xuid) {
        elPanel.SetHasClass("show-controls", MyPersonaAPI.GetXuid() === xuid);
    }
    function _AddOpenPlayerCardAction(elPanel, xuid) {
        elPanel.SetPanelEvent("onactivate", () => {
            if (xuid !== "0") {
                const contextMenuPanel = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent('', '', 'file://{resources}/layout/context_menus/context_menu_playercard.xml', 'xuid=' + xuid, () => { });
                contextMenuPanel.AddClass("ContextMenu_NoArrow");
            }
        });
    }
    {
        if ($.DbgIsReloadingScript()) {
        }
    }
})(VanityPlayerInfo || (VanityPlayerInfo = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFuaXR5X3BsYXllcl9pbmZvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vY29udGVudC9jc2dvL3Bhbm9yYW1hL3NjcmlwdHMvdmFuaXR5X3BsYXllcl9pbmZvLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxrQ0FBa0M7QUFDbEMsa0NBQWtDO0FBQ2xDLDhDQUE4QztBQUM5Qyx3Q0FBd0M7QUFDeEMseUNBQXlDO0FBQ3pDLHNDQUFzQztBQVl0QyxJQUFVLGdCQUFnQixDQTZSekI7QUE3UkQsV0FBVSxnQkFBZ0I7SUFFekIsU0FBZ0IsNkJBQTZCLENBQUcsV0FBeUIsSUFBSSxFQUFFLFlBQTRDLElBQUk7UUFFOUgsSUFBSyxDQUFDLFFBQVEsRUFDZDtZQUNDLFFBQVEsR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7U0FDL0I7UUFFRCxNQUFNLFFBQVEsR0FBRyx3QkFBd0IsR0FBRyxTQUFVLENBQUMsU0FBUyxDQUFDO1FBQ2pFLElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBRSxRQUFRLENBQUUsQ0FBQztRQUUxRCxJQUFLLENBQUMsUUFBUSxFQUNkO1lBQ0MsUUFBUSxHQUFHLENBQUMsQ0FBQyxXQUFXLENBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUUsQ0FBQztZQUN6RCxRQUFRLENBQUMsV0FBVyxDQUFFLGtEQUFrRCxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUUsQ0FBQztZQUN6RixRQUFRLENBQUMsUUFBUSxDQUFFLGtCQUFrQixHQUFHLFNBQVUsQ0FBQyxTQUFTLENBQUUsQ0FBQztZQUMvRCxRQUFRLENBQUMsUUFBUSxDQUFFLE1BQU0sQ0FBRSxDQUFDO1NBQzVCO1FBRUQsUUFBUSxDQUFFLFFBQVEsRUFBRSxTQUFVLENBQUMsSUFBSSxDQUFFLENBQUM7UUFDdEMsVUFBVSxDQUFFLFFBQVEsRUFBRSxTQUFVLENBQUMsSUFBSSxDQUFFLENBQUM7UUFDeEMsUUFBUSxDQUFF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