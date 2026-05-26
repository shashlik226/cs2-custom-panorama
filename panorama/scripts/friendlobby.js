"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="rating_emblem.ts" />
/// <reference path="common/commonutil.ts" />
var friendLobby;
(function (friendLobby) {
    let _m_xuid = '';
    let _m_isInPopup = false;
    function Init(elTile) {
        const _m_isPerfectWorld = MyPersonaAPI.GetLauncherType() === "perfectworld" ? true : false;
        _m_xuid = elTile.GetAttributeString('xuid', '(not found)');
        if (_m_xuid === '(not found)') {
            return;
        }
        _m_isInPopup = elTile.GetAttributeString('showinpopup', 'false') === 'true' ? true : false;
        let lobbyType = PartyBrowserAPI.GetPartyType(_m_xuid);
        let gameMode = PartyBrowserAPI.GetPartySessionSetting(_m_xuid, 'game/mode');
        elTile.SetHasClass('playerforhire', (lobbyType === 'nearby'));
        _SetLobbyLeaderNameAvatar(elTile, lobbyType);
        _SetGroupNameLink(elTile, lobbyType);
        _SetPrime(elTile);
        if (!_m_isPerfectWorld) {
            _SetRegion(elTile);
        }
        _SetSkillGroup(elTile, gameMode);
        _SetLobbySettings(elTile, gameMode);
        _SetLobbyPlayerSlots(elTile, gameMode, lobbyType);
        _SetUpJoinBtn(elTile, lobbyType);
        _SetUpLobbiesPopupBtn(elTile);
        _SetDismissButton(elTile, lobbyType);
        elTile.SetHasClass('friendlobby--is-in-popup', _m_isInPopup);
    }
    friendLobby.Init = Init;
    function _SetLobbyLeaderNameAvatar(elTile, lobbyType) {
        let xuidLobbyLeader = PartyBrowserAPI.GetPartyMemberXuid(_m_xuid, 0);
        let rawName = FriendsListAPI.GetFriendName(xuidLobbyLeader);
        elTile.SetDialogVariable('friendname', $.HTMLEscape(rawName));
        let nameString = (lobbyType === 'invited') ? '#tooltip_friend_invited_you' : "#tooltip_lobby_leader_name";
        elTile.FindChildTraverse('JsFriendLobbyLeaderName').text = nameString;
        elTile.FindChildTraverse('JsFriendLobbyLeaderAvatar').PopulateFromSteamID(xuidLobbyLeader);
        elTile.FindChildTraverse('JsFriendLobbyLeaderBtn').SetPanelEvent('onactivate', () => _OpenContextMenu(xuidLobbyLeader));
    }
    function _SetPrime(elTile) {
        let primeValue = PartyBrowserAPI.GetPartySessionSetting(_m_xuid, 'game/apr');
        elTile.FindChildTraverse('JsFriendLobbyPrime').visible = (primeValue && primeValue != '0') ? true : false;
    }
    function _SetRegion(elTile) {
        let countryCode = PartyBrowserAPI.GetPartySessionSetting(_m_xuid, 'game/loc');
        CommonUtil.SetRegionOnLabel(countryCode, elTile);
    }
    function _SetSkillGroup(elTile, gameMode) {
        let szSkillGroupType = "Competitive";
        if (gameMode === 'scrimcomp2v2') {
            szSkillGroupType = 'Wingman';
        }
        else {
            szSkillGroupType = 'Premier';
        }
        let score = Number(PartyBrowserAPI.GetPartySessionSetting(_m_xuid, 'game/ark'));
        score = Math.floor(score / 10);
        const options = {
            root_panel: elTile.FindChildTraverse('jsRatingEmblem'),
            do_fx: true,
            full_details: false,
            rating_type: szSkillGroupType,
            leaderboard_details: { score: score },
            local_player: _m_xuid === MyPersonaAPI.GetXuid()
        };
        RatingEmblem.SetXuid(options);
    }
    function _SetLobbySettings(elTile, gameMode) {
        let gameModeType = GameTypesAPI.GetGameModeType(gameMode);
        let gameModeDisplay = GameTypesAPI.GetGameModeAttribute(gameModeType, gameMode, 'nameID');
        elTile.SetDialogVariable('lobby-mode', $.Localize(gameModeDisplay));
        elTile.SetDialogVariable('lobby-maps', _GetMapNames(gameMode));
    }
    function _GetMapNames(gameMode) {
        let mapGroups = PartyBrowserAPI.GetPartySessionSetting(_m_xuid, 'game/mapgroupname');
        if (mapGroups == 'workshop')
            return $.Localize('#SFUI_Groups_workshop');
        if (!mapGroups)
            mapGroups = '';
        let mapsList = mapGroups.split(',');
        let mapsNiceNamesList = [];
        for (let i = 0; i < mapsList.length; i++) {
            if (i < 4) {
                let mapNiceName = GameTypesAPI.GetMapGroupAttribute(mapsList[i], 'nameID');
                mapsNiceNamesList.push($.Localize(mapNiceName));
            }
        }
        return mapsNiceNamesList.join(', ');
    }
    function _SetLobbyPlayerSlots(elTile, gameMode, lobbyType) {
        if (lobbyType === 'nearby')
            return;
        let numSlotsToShow = SessionUtil.GetMaxLobbySlotsForGameMode(gameMode) - 1;
        let elAvatarRow = elTile.FindChildTraverse('JsFriendLobbyAvatars');
        for (let i = 1; i <= numSlotsToShow; i++) {
            let xuid = PartyBrowserAPI.GetPartyMemberXuid(_m_xuid, i);
            let slotId = _m_xuid + ':' + i;
            let playerSlot = elAvatarRow.FindChild(slotId);
            if (!playerSlot) {
                playerSlot = $.CreatePanel('Panel', elAvatarRow, slotId);
                playerSlot.BLoadLayoutSnippet('FriendLobbyAvatarSlot');
            }
            if (i === 1)
                playerSlot.AddClass('friendlobby__slot--first');
            let elEmpty = playerSlot.FindChildTraverse('JsFriendAvatarEmpty');
            let elAvatar = playerSlot.FindChildTraverse('JsFriendAvatar');
            if (xuid) {
                elAvatar.PopulateFromSteamID(xuid);
                playerSlot.FindChild('JsFriendAvatarBtn').SetPanelEvent('onactivate', () => _OpenContextMenu(xuid));
                elEmpty.visible = false;
                elAvatar.visible = true;
            }
            else {
                elEmpty.visible = true;
                elAvatar.visible = false;
            }
        }
    }
    function _SetUpJoinBtn(elTile, lobbyType) {
        let elJoinBtn = elTile.FindChildInLayoutFile('JsFriendLobbyJoinBtn');
        let clientInLobby = false;
        let clientXuid = MyPersonaAPI.GetXuid();
        let count = PartyBrowserAPI.GetPartyMembersCount(_m_xuid);
        for (let i = 0; i <= count; i++) {
            if (clientXuid === PartyBrowserAPI.GetPartyMemberXuid(_m_xuid, i)) {
                clientInLobby = true;
                break;
            }
        }
        if (clientInLobby || lobbyType === 'suggested') {
            elJoinBtn.AddClass('hidden');
            return;
        }
        elJoinBtn.RemoveClass('hidden');
        let tooltipText = $.Localize((lobbyType === 'invited') ? '#tooltip_accept_invite' : '#tooltip_join_public_lobby');
        elJoinBtn.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip('JsFriendLobbyJoinBtn', tooltipText));
        elJoinBtn.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
        let lobbyLeaderXuid = _m_xuid;
        elJoinBtn.SetPanelEvent('onactivate', () => {
            $.DispatchEvent('CSGOPlaySoundEffectMuteBypass', 'PanoramaUI.Lobby.Joined', 'MOUSE', 1.0);
            PartyBrowserAPI.ActionJoinParty(lobbyLeaderXuid);
        });
    }
    function _SetGroupNameLink(elTile, lobbyType) {
        let elGroupLBtn = elTile.FindChildTraverse('JsFriendLobbyGroupBtn');
        let elGroupLabel = elTile.FindChildTraverse('JsFriendLobbyGroupTxt');
        if (lobbyType === 'invited') {
            elGroupLabel.visible = false;
            elGroupLBtn.visible = false;
        }
        if (lobbyType === 'nearby') {
            elGroupLabel.text = $.Localize('#SFUI_Lobby_GroupsNearby');
            elGroupLBtn.enabled = false;
        }
        else {
            let clanId = PartyBrowserAPI.GetPartySessionSetting(_m_xuid, "game/clanid");
            let clanName = PartyBrowserAPI.GetPartySessionSetting(_m_xuid, "game/clantag");
            if (lobbyType === 'suggested') {
                elGroupLabel.SetDialogVariable('group', clanName);
                elGroupLabel.text = $.Localize('#FriendsLobby_GroupsSuggested', elGroupLabel);
            }
            else {
                elGroupLabel.SetDialogVariable('group', clanName);
                elGroupLabel.text = $.Localize('#FriendsLobby_GroupName', elGroupLabel);
            }
            let onActivate = _GetClanLink(clanId);
            elGroupLBtn.SetPanelEvent('onactivate', onActivate);
            elGroupLBtn.enabled = true;
        }
    }
    function _SetDismissButton(elTile, lobbyType) {
        if (lobbyType === 'invited') {
            var elCloseButton = elTile.FindChildInLayoutFile('FriendLobbyCloseButton');
            elCloseButton.RemoveClass('hidden');
            elCloseButton.SetPanelEvent("onactivate", function () {
                $.DispatchEvent('CSGOPlaySoundEffectMuteBypass', 'PanoramaUI.Lobby.Left', 'MOUSE', 1.0);
                PartyBrowserAPI.ClearInvite(elTile.GetAttributeString('xuid', '(not found)'));
            });
            elCloseButton.SetPanelEvent('onmouseover', () => {
                UiToolkitAPI.ShowTextTooltip('FriendLobbyCloseButton', $.Localize('#tooltip_discard_invite'));
            });
            elCloseButton.SetPanelEvent('onmouseout', () => {
                UiToolkitAPI.HideTextTooltip();
            });
        }
    }
    function _SetUpLobbiesPopupBtn(elTile) {
        let elAlert = elTile.FindChildInLayoutFile('JsFriendLobbyCount');
        let nLobbies = PartyBrowserAPI.GetInvitesCount();
        if (nLobbies < 2) {
            elTile.FindChildInLayoutFile('JsFriendLobbySeeAllInvites').visible = false;
            return;
        }
        if (elAlert && elAlert.IsValid()) {
            elAlert.SetDialogVariable("lobby_count", (nLobbies - 1).toString());
            elAlert.SetDialogVariable("alert_value", $.Localize('#friends_lobby_count', elAlert));
        }
        let elBtn = elTile.FindChildInLayoutFile('JsFriendLobbySeeAllInvitesBtn');
        elBtn.SetPanelEvent('onmouseover', () => {
            UiToolkitAPI.ShowTextTooltip('JsFriendLobbySeeAllInvitesBtn', $.Localize('#tooltip_lobby_count'));
        });
        elBtn.SetPanelEvent('onmouseout', () => {
            UiToolkitAPI.HideTextTooltip();
        });
        elBtn.SetPanelEvent('onactivate', OpenLobbiesContextMenu);
    }
    function OpenLobbiesContextMenu() {
        var contextMenuPanel = UiToolkitAPI.ShowCustomLayoutContextMenu('', '', 'file://{resources}/layout/context_menus/context_menu_lobbies.xml');
        contextMenuPanel.AddClass("ContextMenu_NoArrow");
    }
    function _GetClanLink(clanId) {
        return () => {
            let link = '';
            if (SteamOverlayAPI.GetAppID() == 710)
                link = "http://beta.steamcommunity.com/gid/" + clanId;
            else
                link = "http://steamcommunity.com/gid/" + clanId;
            SteamOverlayAPI.OpenURL(link);
        };
    }
    function _OpenContextMenu(xuid) {
        $.DispatchEvent('SidebarContextMenuActive', true);
        var contextMenuPanel = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent('', '', 'file://{resources}/layout/context_menus/context_menu_playercard.xml', 'xuid=' + xuid, () => $.DispatchEvent('SidebarContextMenuActive', false));
        contextMenuPanel.AddClass("ContextMenu_NoArrow");
    }
})(friendLobby || (friendLobby = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJpZW5kbG9iYnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9mcmllbmRsb2JieS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsa0NBQWtDO0FBQ2xDLHlDQUF5QztBQUN6Qyw2Q0FBNkM7QUFFN0MsSUFBVSxXQUFXLENBeVZwQjtBQXpWRCxXQUFVLFdBQVc7SUFFcEIsSUFBSSxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLElBQUksWUFBWSxHQUFXLEtBQUssQ0FBQztJQUVqQyxTQUFnQixJQUFJLENBQUUsTUFBYztRQUVuQyxNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxlQUFlLEVBQUUsS0FBSyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBRTNGLE9BQU8sR0FBRyxNQUFNLENBQUMsa0JBQWtCLENBQUUsTUFBTSxFQUFFLGFBQWEsQ0FBRSxDQUFDO1FBRTdELElBQUksT0FBTyxLQUFJLGFBQWEsRUFDNUI7WUFDQyxPQUFPO1NBQ1A7UUFFRCxZQUFZLEdBQUcsTUFBTSxDQUFDLGtCQUFrQixDQUFFLGFBQWEsRUFBRSxPQUFPLENBQUUsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQzdGLElBQUksU0FBUyxHQUFVLGVBQWUsQ0FBQyxZQUFZLENBQUUsT0FBTyxDQUFFLENBQUM7UUFDL0QsSUFBSSxRQUFRLEdBQVUsZUFBZSxDQUFDLHNCQUFzQixDQUFFLE9BQU8sRUFBQyxXQUFXLENBQUUsQ0FBQztRQUdwRixNQUFNLENBQUMsV0FBVyxDQUFFLGVBQWUsRUFBRSxDQUFFLFNBQVMsS0FBSyxRQUFRLENBQUUsQ0FBRSxDQUFDO1FBRWxFLHlCQUF5QixDQUFFLE1BQU0sRUFBRSxTQUFTLENBQUUsQ0FBQztRQUMvQyxpQkFBaUIsQ0FBRSxNQUFNLEVBQUUs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