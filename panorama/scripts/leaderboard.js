"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="rating_emblem.ts" />
/// <reference path="common/teamcolor.ts" />
/// <reference path="honor_icon.ts" />
const regionToRegionName = {
    'namc': 'NorthAmerica',
    'samc': 'SouthAmerica',
    'euro': 'Europe',
    'asia': 'Asia',
    'ausc': 'Australia',
    'afrc': 'Africa',
    'cn': 'China',
};
var Leaderboard;
(function (Leaderboard) {
    function _msg(msg) {
    }
    let m_bEventsRegistered = false;
    let m_myXuid = MyPersonaAPI.GetXuid();
    let m_lbType;
    let m_LeaderboardsDirtyEventHandler;
    let m_LeaderboardsStateChangeEventHandler;
    let m_FriendsListNameChangedEventHandler;
    let m_LobbyPlayerUpdatedEventHandler;
    let m_NameLockEventHandler;
    let m_leaderboardName = '';
    let m_onlyAvailableSeasonLeaderboard = '';
    const IS_NEW_SEASON = false;
    const IS_AROUND_PLAYER = true;
    function RegisterEventHandlers() {
        _msg('RegisterEventHandlers');
        if (!m_bEventsRegistered) {
            m_LeaderboardsDirtyEventHandler = $.RegisterForUnhandledEvent('PanoramaComponent_Leaderboards_Dirty', OnLeaderboardDirty);
            m_LeaderboardsStateChangeEventHandler = $.RegisterForUnhandledEvent('PanoramaComponent_Leaderboards_StateChange', OnLeaderboardStateChange);
            m_FriendsListNameChangedEventHandler = $.RegisterForUnhandledEvent('PanoramaComponent_FriendsList_NameChanged', _UpdateName);
            if (m_lbType === 'party') {
                m_LobbyPlayerUpdatedEventHandler = $.RegisterForUnhandledEvent("PanoramaComponent_PartyList_RebuildPartyList", _UpdatePartyList);
            }
            if (m_lbType === 'general') {
                m_NameLockEventHandler = $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_SetPlayerLeaderboardSafeName', _UpdateNameLockButton);
            }
            m_bEventsRegistered = true;
        }
    }
    Leaderboard.RegisterEventHandlers = RegisterEventHandlers;
    function UnregisterEventHandlers() {
        _msg('UnregisterEventHandlers');
        if (m_bEventsRegistered) {
            $.UnregisterForUnhandledEvent('PanoramaComponent_Leaderboards_Dirty', m_LeaderboardsDirtyEventHandler);
            $.UnregisterForUnhandledEvent('PanoramaComponent_Leaderboards_StateChange', m_LeaderboardsStateChangeEventHandler);
            $.UnregisterForUnhandledEvent('PanoramaComponent_FriendsList_NameChanged', m_FriendsListNameChangedEventHandler);
            if (m_lbType === 'party') {
                $.UnregisterForUnhandledEvent('PanoramaComponent_PartyList_RebuildPartyList', m_LobbyPlayerUpdatedEventHandler);
            }
            if (m_lbType === 'general') {
                $.UnregisterForUnhandledEvent('PanoramaComponent_MyPersona_SetPlayerLeaderboardSafeName', m_NameLockEventHandler);
            }
            m_bEventsRegistered = false;
        }
    }
    Leaderboard.UnregisterEventHandlers = UnregisterEventHandlers;
    function _Init() {
        _msg('init');
        m_lbType = $.GetContextPanel().GetAttributeString('lbtype', '');
        RegisterEventHandlers();
        _SetTitle();
        _InitNavPanels();
        _UpdateLeaderboardName();
        if (m_lbType === 'party') {
            _UpdatePartyList();
            if (LeaderboardsAPI.DoesTheLocalPlayerNeedALeaderboardSafeNameSet()) {
                _AutomaticLeaderboardNameLockPopup();
            }
        }
        else if (m_lbType === 'general') {
            UpdateLeaderboardList();
            $.Schedule(0.5, _UpdateNameLockButton);
        }
        _ShowGlobalRank();
    }
    function _SetHonorIcon(elPanel, xuid) {
        const honorIconOptions = {
            honor_icon_frame_panel: elPanel.FindChildTraverse('jsHonorIcon'),
            xuid: xuid,
            do_fx: true,
            xptrail_value: PartyListAPI.GetFriendXpTrailLevel(xuid),
            prime_value: PartyListAPI.GetFriendPrimeEligible(xuid)
        };
        HonorIcon.SetOptions(honorIconOptions);
    }
    function _SetTitle() {
        $.GetContextPanel().SetDialogVariable('leaderboard-title', $.Localize('#leaderboard_title_' + String(m_lbType)));
    }
    function _InitSeason() {
        m_onlyAvailableSeasonLeaderboard = LeaderboardsAPI.GetCurrentSeasonPremierLeaderboard();
        let elSeason = $.GetContextPanel().FindChildTraverse('jsNavSeason');
        elSeason.text = $.Localize('#' + m_onlyAvailableSeasonLeaderboard + '_name');
    }
    let _LastRegionList = '';
    function _MaybeRefreshRegionsDropdown() {
        if (m_lbType === 'party')
            return;
        let currentRegionList = '(friends)';
        const arrLBsOfInterest = LeaderboardsAPI.GetPremierLeaderboardsOfInterest();
        for (let i = 0; i < arrLBsOfInterest.length; i++) {
            currentRegionList = currentRegionList + '(' + arrLBsOfInterest[i] + ')';
        }
        if (_LastRegionList === currentRegionList) {
            return;
        }
        _LastRegionList = currentRegionList;
        _InitLocationDropdown();
    }
    function _InitLocationDropdown() {
        let elLocationDropdown = $('#jsNavLocation');
        elLocationDropdown.visible = true;
        elLocationDropdown.RemoveAllOptions();
        let regions = LeaderboardsAPI.GetAllSeasonPremierLeaderboardRegions();
        regions.sort();
        regions.unshift('World');
        regions.unshift('Friends');
        let defaultRegion = 'World';
        for (let i = 0; i < regions.length; i++) {
            const szRegion = regions[i];
            const bCurrentRegion = _FindLocalPlayerInRegion(szRegion);
            if (IS_AROUND_PLAYER && !bCurrentRegion && (szRegion != 'Friends'))
                continue;
            const elEntry = $.CreatePanel('Label', elLocationDropdown, szRegion);
            elEntry.SetHasClass('of-interest', bCurrentRegion && (szRegion != 'Friends') && !IS_NEW_SEASON && !IS_AROUND_PLAYER);
            switch (szRegion) {
                case 'World':
                    elEntry.SetAttributeString('leaderboard-class', szRegion.toLowerCase());
                    break;
                case 'Friends':
                    elEntry.SetAttributeString('friendslb', 'true');
                    elEntry.SetAttributeString('leaderboard-class', 'friends');
                    break;
                default:
                    elEntry.SetAttributeString('location-suffix', '_' + szRegion);
                    elEntry.SetAttributeString('leaderboard-class', szRegion.toLowerCase());
                    if (bCurrentRegion) {
                        defaultRegion = szRegion;
                    }
            }
            elEntry.SetAcceptsFocus(true);
            elEntry.text = $.Localize('#leaderboard_region_' + szRegion);
            elLocationDropdown.AddOption(elEntry);
        }
        {
            defaultRegion = 'friends';
        }
        elLocationDropdown.SetSelected(defaultRegion);
    }
    function _getRegionFromLeaderboardName(lbname) {
        return lbname.split('_').slice(-1)[0];
    }
    function _isLeaderboardTheFriendsLeaderboard(lbname) {
        return lbname.split('.').slice(-1)[0] === 'friends';
    }
    function _FindLocalPlayerInRegion(region) {
        let arrLBsOfInterest = LeaderboardsAPI.GetPremierLeaderboardsOfInterest();
        for (let i = 0; i < arrLBsOfInterest.length; i++) {
            switch (region) {
                case 'World':
                    if (arrLBsOfInterest[i] === m_onlyAvailableSeasonLeaderboard)
                        return true;
                    break;
                case 'Friends':
                    if (_isLeaderboardTheFriendsLeaderboard(arrLBsOfInterest[i]))
                        return true;
                    break;
                default:
                    if (_getRegionFromLeaderboardName(arrLBsOfInterest[i]) === region)
                        return true;
            }
        }
        return false;
    }
    function _UpdateLeaderboardName() {
        if (m_lbType === 'general') {
            let elLocationDropdown = $('#jsNavLocation');
            let elregion = elLocationDropdown.GetSelected();
            if (elregion) {
                if (elregion.GetAttributeString('friendslb', '') === 'true') {
                    m_leaderboardName = m_onlyAvailableSeasonLeaderboard + '.friends';
                }
                else {
                    m_leaderboardName = m_onlyAvailableSeasonLeaderboard + elregion.GetAttributeString('location-suffix', '') +
                        (IS_AROUND_PLAYER ? '.self' : '');
                }
                $.GetContextPanel().SwitchClass('region', elregion.GetAttributeString('leaderboard-class', ''));
            }
        }
        else if (m_lbType === 'party') {
            m_leaderboardName = LeaderboardsAPI.GetCurrentSeasonPremierLeaderboard() + '.party';
        }
        _msg(m_leaderboardName);
        return m_leaderboardName;
    }
    function _UpdateNameLockButton() {
        let elNameButton = $.GetContextPanel().FindChildTraverse('lbNameButton');
        elNameButton.visible = true;
        let status = MyPersonaAPI.GetMyLeaderboardNameStatus();
        let needsName = LeaderboardsAPI.DoesTheLocalPlayerNeedALeaderboardSafeNameSet();
        let showButton = status !== '' || needsName;
        elNameButton.visible = showButton;
        elNameButton.SetHasClass('no-hover', status !== '');
        elNameButton.ClearPanelEvent('onactivate');
        let buttonText = '';
        if (status) {
            let name = MyPersonaAPI.GetMyLeaderboardName();
            elNameButton.SetDialogVariable('leaderboard-name', name);
            buttonText = $.Localize('#leaderboard_namelock_button_hasname', elNameButton);
            let tooltipText = '';
            switch (status) {
                case 'submitted':
                    elNameButton.SwitchClass('status', 'submitted');
                    tooltipText = $.Localize('#leaderboard_namelock_button_tooltip_submitted');
                    break;
                case 'approved':
                    elNameButton.SwitchClass('status', 'approved');
                    tooltipText = $.Localize('#leaderboard_namelock_button_tooltip_approved');
                    break;
            }
            function onMouseOver(id, tooltipText) {
                UiToolkitAPI.ShowTextTooltip(id, tooltipText);
            }
            elNameButton.SetPanelEvent('onmouseover', onMouseOver.bind(elNameButton, elNameButton.id, tooltipText));
            elNameButton.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
        }
        else if (needsName) {
            buttonText = $.Localize('#leaderboard_namelock_button_needsname');
            elNameButton.SetPanelEvent('onactivate', _NameLockPopup);
        }
        elNameButton.SetDialogVariable('leaderboard_namelock_button', buttonText);
    }
    function _InitNavPanels() {
        $('#jsNavLocation').visible = false;
        $('#jsGoToTop').visible = (m_lbType === 'general') && !IS_AROUND_PLAYER;
        $('#jsGoToMe').visible = (m_lbType === 'general') && !IS_AROUND_PLAYER;
        if (m_lbType === 'party')
            return;
        _InitSeason();
        _MaybeRefreshRegionsDropdown();
    }
    function _ShowGlobalRank() {
        let showRank = $.GetContextPanel().GetAttributeString('showglobaloverride', 'true');
        $.GetContextPanel().SetHasClass('hide-global-rank', showRank === 'false');
    }
    function _UpdateGoToMeButton() {
        let lb = m_leaderboardName;
        let arrLBsOfInterest = LeaderboardsAPI.GetPremierLeaderboardsOfInterest();
        let myIndex = LeaderboardsAPI.GetIndexByXuid(lb, m_myXuid);
        let bPresent = arrLBsOfInterest.includes(lb) && myIndex !== -1;
        $.GetContextPanel().FindChildInLayoutFile('jsGoToMe').enabled = bPresent && !IS_NEW_SEASON && !IS_AROUND_PLAYER;
    }
    function _ShowNoData() {
        $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-list').visible = false;
        $.GetContextPanel().SwitchClass('leaderboard-status', 'lb-status-nodata');
    }
    function _ShowNewSeason() {
        $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-list').visible = false;
        $.GetContextPanel().SwitchClass('leaderboard-status', 'lb-status-newseason');
    }
    function _ShowNewSeasonFriends() {
        $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-list').visible = false;
        $.GetContextPanel().SwitchClass('leaderboard-status', 'lb-status-newseason-friends');
    }
    function _ShowLoading() {
        $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-list').visible = false;
        $.GetContextPanel().SwitchClass('leaderboard-status', 'lb-status-loading');
    }
    function _ShowLeaderboards() {
        $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-list').visible = true;
        $.GetContextPanel().SwitchClass('leaderboard-status', 'lb-status-ready');
        if (m_lbType === 'general' && IS_AROUND_PLAYER) {
            GoToSelf();
        }
    }
    function UpdateLeaderboardList() {
        _msg('-------------- UpdateLeaderboardList ' + m_leaderboardName);
        _UpdateGoToMeButton();
        let count = LeaderboardsAPI.GetCount(m_leaderboardName);
        let status = LeaderboardsAPI.GetState(m_leaderboardName);
        _msg(status + '');
        let seasonName = $.Localize('#' + m_onlyAvailableSeasonLeaderboard + '_name');
        $.GetContextPanel().SetDialogVariable('season_name', seasonName);
        if ("ready" == status && count !== 0) {
            _FillOutEntries();
        }
        if (1 <= LeaderboardsAPI.HowManyMinutesAgoCached(m_leaderboardName)) {
            LeaderboardsAPI.Refresh(m_leaderboardName);
            _msg('leaderboard status: requested');
        }
        if (m_leaderboardName.includes('friends')) {
            if (count == 0) {
                _ShowNewSeasonFriends();
            }
            else {
                _ShowLeaderboards();
            }
            return;
        }
        if (IS_NEW_SEASON) {
            _ShowNewSeason();
        }
        else {
            if (("none" == status) || ("ready" == status && count == 0)) {
                if (IS_AROUND_PLAYER)
                    _ShowNewSeasonFriends();
                else
                    _ShowNoData();
            }
            else if ("loading" == status) {
                _ShowLoading();
            }
            else if ("ready" == status) {
                _ShowLeaderboards();
            }
        }
    }
    Leaderboard.UpdateLeaderboardList = UpdateLeaderboardList;
    function _AddPlayer(elEntry, oPlayer, index) {
        elEntry.SetDialogVariable('player-rank', '');
        elEntry.SetDialogVariable('player-name', '');
        elEntry.SetDialogVariable('player-wins', '');
        elEntry.SetDialogVariable('player-winrate', '');
        elEntry.SetDialogVariable('player-percentile', '');
        elEntry.SetHasClass('no-hover', oPlayer === null);
        elEntry.SetHasClass('background', index % 2 === 0);
        let elAvatar = elEntry.FindChildInLayoutFile('leaderboard-entry-avatar');
        elAvatar.visible = false;
        if (oPlayer) {
            function _AddOpenPlayerCardAction(elPanel, xuid) {
                function openCard() {
                    if (xuid && (xuid !== 0)) {
                        $.DispatchEvent('SidebarContextMenuActive', true);
                        let contextMenuPanel = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent('', '', 'file://{resources}/layout/context_menus/context_menu_playercard.xml', 'xuid=' + xuid, () => $.DispatchEvent('SidebarContextMenuActive', false));
                        contextMenuPanel.AddClass("ContextMenu_NoArrow");
                    }
                }
                elPanel.SetPanelEvent("onactivate", openCard);
                elPanel.SetPanelEvent("oncontextmenu", openCard);
            }
            elEntry.enabled = true;
            if (m_lbType === 'party' && oPlayer.XUID) {
                elAvatar.PopulateFromSteamID(oPlayer.XUID);
                elAvatar.visible = true;
                _SetHonorIcon(elEntry, oPlayer.XUID);
            }
            else {
                elAvatar.visible = false;
            }
            let elRatingEmblem = elEntry.FindChildTraverse('jsRatingEmblem');
            if (m_lbType === 'party') {
                const teamColorIdx = PartyListAPI.GetPartyMemberSetting(oPlayer.XUID, 'game/teamcolor');
                const teamColorRgb = TeamColor.GetTeamColor(Number(teamColorIdx));
                elAvatar.style.border = '2px solid rgb(' + teamColorRgb + ')';
            }
            _AddOpenPlayerCardAction(elEntry, oPlayer.XUID);
            let options;
            if (m_lbType === 'party') {
                options =
                    {
                        root_panel: elRatingEmblem,
                        rating_type: 'Premier',
                        do_fx: true,
                        leaderboard_details: oPlayer,
                        full_details: false,
                        local_player: oPlayer.XUID === MyPersonaAPI.GetXuid()
                    };
            }
            else {
                options =
                    {
                        root_panel: elRatingEmblem,
                        rating_type: 'Premier',
                        do_fx: true,
                        leaderboard_details: oPlayer,
                        full_details: false,
                        local_player: oPlayer.XUID === MyPersonaAPI.GetXuid()
                    };
            }
            RatingEmblem.SetXuid(options);
            elEntry.SetDialogVariable('player-name', oPlayer.displayName ?? FriendsListAPI.GetFriendName(oPlayer.XUID));
            elEntry.Data().allowNameUpdates = !oPlayer.hasOwnProperty('displayName');
            elEntry.SetDialogVariable('player-wins', oPlayer.hasOwnProperty('matchesWon') ? String(oPlayer.matchesWon) : '-');
            let bHasRank = oPlayer.hasOwnProperty('rank') && oPlayer.rank > 0;
            elEntry.SetDialogVariableInt('player-rank', bHasRank ? oPlayer.rank : 0);
            elEntry.FindChildTraverse('jsPlayerRank').text = bHasRank ? $.Localize('{d:player-rank}', elEntry) : '-';
            let canShowWinRate = oPlayer.hasOwnProperty('matchesWon') && oPlayer.hasOwnProperty('matchesTied') && oPlayer.hasOwnProperty('matchesLost');
            if (canShowWinRate) {
                let matchesPlayed = (oPlayer.matchesWon ? oPlayer.matchesWon : 0) +
                    (oPlayer.matchesTied ? oPlayer.matchesTied : 0) +
                    (oPlayer.matchesLost ? oPlayer.matchesLost : 0);
                let winRate = matchesPlayed === 0 ? 0 : oPlayer.matchesWon * 100.00 / matchesPlayed;
                elEntry.SetDialogVariable('player-winrate', winRate.toFixed(2) + '%');
            }
            else {
                elEntry.SetDialogVariable('player-winrate', '-');
            }
            elEntry.SetDialogVariable('player-percentile', (oPlayer.hasOwnProperty('pct') && oPlayer.pct && oPlayer.pct > 0) ? oPlayer.pct.toFixed(0) + '%' : '-');
            elEntry.SetDialogVariable('player-region', (oPlayer.hasOwnProperty('region')) ? $.Localize('#leaderboard_region_abbr_' + regionToRegionName[oPlayer.region]) : '-');
        }
        return elEntry;
    }
    function _UpdatePartyList() {
        if (m_lbType !== 'party')
            return;
        let elStatus = $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-loading');
        let elNoData = $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-nodata');
        let elLeaderboardList = $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-list');
        elLeaderboardList.SetHasClass('hidden', false);
        elStatus.SetHasClass('hidden', true);
        elNoData.SetHasClass('hidden', true);
        function OnMouseOver(xuid) {
            $.DispatchEvent('LeaderboardHoverPlayer', xuid);
        }
        function OnMouseOut() {
            $.DispatchEvent('LeaderboardHoverPlayer', '');
        }
        let elList = $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-entries');
        if (LobbyAPI.IsSessionActive()) {
            let members = LobbyAPI.GetSessionSettings().members;
            function GetPartyLBRow(idx) {
                let oPlayer = null;
                let machine = 'machine' + idx;
                let bValidPartyPlayer = members.hasOwnProperty(machine) && members[machine].hasOwnProperty('player0') &&
                    members[machine].player0.hasOwnProperty('xuid');
                if (!bValidPartyPlayer)
                    return null;
                let xuid = members[machine].player0.xuid;
                oPlayer = LeaderboardsAPI.GetEntryDetailsObjectByXuid(m_leaderboardName, xuid);
                if (!oPlayer.XUID) {
                    oPlayer.XUID = xuid;
                }
                if (PartyListAPI.GetFriendCompetitiveRankType(xuid) === "Premier") {
                    let partyScore = PartyListAPI.GetFriendCompetitiveRank(xuid);
                    let partyWins = PartyListAPI.GetFriendCompetitiveWins(xuid);
                    if (partyScore || partyWins) {
                        oPlayer.score = PartyListAPI.GetFriendCompetitiveRank(xuid);
                        oPlayer.matchesWon = PartyListAPI.GetFriendCompetitiveWins(xuid);
                        oPlayer.rankWindowStats = PartyListAPI.GetFriendCompetitivePremierWindowStatsObject(xuid);
                        _msg('PartyList player ' + xuid + ' score=' + oPlayer.score + ' wins=' + oPlayer.matchesWon + ' data={' + JSON.stringify(oPlayer) + '}');
                    }
                }
                return oPlayer;
            }
            elList.SetLoadListItemFunction((parent, nPanelIdx, reusePanel) => {
                let oPlayer = GetPartyLBRow(nPanelIdx);
                if (!reusePanel || !reusePanel.IsValid()) {
                    reusePanel = $.CreatePanel("Button", elList, oPlayer ? oPlayer.XUID : '');
                    reusePanel.BLoadLayoutSnippet("leaderboard-entry");
                }
                _AddPlayer(reusePanel, oPlayer, nPanelIdx);
                reusePanel.SetPanelEvent('onmouseover', oPlayer ? OnMouseOver.bind(reusePanel, oPlayer.XUID) : OnMouseOut);
                reusePanel.SetPanelEvent('onmouseout', OnMouseOut);
                return reusePanel;
            });
            elList.UpdateListItems(PartyListAPI.GetCount());
        }
    }
    function OnLeaderboardDirty(type) {
        _msg('OnLeaderboardDirty');
        if (m_leaderboardName && m_leaderboardName === type) {
            _MaybeRefreshRegionsDropdown();
            LeaderboardsAPI.Refresh(m_leaderboardName);
        }
    }
    function ReadyForDisplay() {
        _msg("ReadyForDisplay");
        RegisterEventHandlers();
        _MaybeRefreshRegionsDropdown();
        if (m_leaderboardName) {
            LeaderboardsAPI.Refresh(m_leaderboardName);
        }
    }
    Leaderboard.ReadyForDisplay = ReadyForDisplay;
    function UnReadyForDisplay() {
        _msg("UnReadyForDisplay");
        UnregisterEventHandlers();
    }
    Leaderboard.UnReadyForDisplay = UnReadyForDisplay;
    function _UpdateName(xuid) {
        let elList = $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-entries');
        let elEntry = elList.FindChildInLayoutFile(xuid);
        if (elEntry && elEntry.Data().allowNameUpdates) {
            elEntry.SetDialogVariable('player-name', FriendsListAPI.GetFriendName(xuid));
        }
    }
    function _NameLockPopup() {
        UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_leaderboard_namelock.xml');
    }
    function _AutomaticLeaderboardNameLockPopup() {
        let data = $.GetContextPanel().Data();
        let bAlreadyAsked = data && data.bPromptedForLeaderboardSafeName;
        if (bAlreadyAsked)
            return;
        _NameLockPopup();
        data.bPromptedForLeaderboardSafeName = true;
    }
    function _FillOutEntries() {
        let nPlayers = LeaderboardsAPI.GetCount(m_leaderboardName);
        _msg(nPlayers + ' accounts found.');
        const elList = $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-entries');
        elList.SetLoadListItemFunction((parent, nPanelIdx, reusePanel) => {
            let oPlayer = LeaderboardsAPI.GetEntryDetailsObjectByIndex(m_leaderboardName, nPanelIdx);
            if (!reusePanel || !reusePanel.IsValid()) {
                reusePanel = $.CreatePanel("Button", elList, oPlayer ? oPlayer.XUID : '');
                reusePanel.BLoadLayoutSnippet("leaderboard-entry");
            }
            _AddPlayer(reusePanel, oPlayer, nPanelIdx);
            reusePanel.SetHasClass('local-player', (oPlayer ? oPlayer.XUID : '') === m_myXuid);
            return reusePanel;
        });
        elList.UpdateListItems(nPlayers);
        if (m_lbType === 'general' && IS_AROUND_PLAYER)
            GoToSelf();
        else
            GoToTop();
    }
    function OnLeaderboardStateChange(type) {
        _msg('OnLeaderboardStateChange');
        _msg('leaderboard status: received');
        if (m_leaderboardName === type) {
            if (m_lbType === 'party') {
                _UpdatePartyList();
            }
            else if (m_lbType === 'general') {
                UpdateLeaderboardList();
            }
            return;
        }
    }
    Leaderboard.OnLeaderboardStateChange = OnLeaderboardStateChange;
    function OnLeaderboardChange() {
        _UpdateLeaderboardName();
        UpdateLeaderboardList();
    }
    Leaderboard.OnLeaderboardChange = OnLeaderboardChange;
    function GoToSelf() {
        let myIndex = LeaderboardsAPI.GetIndexByXuid(m_leaderboardName, m_myXuid);
        const elList = $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-entries');
        $.DispatchEvent('ScrollToDelayLoadListItem', elList, myIndex, 'center', true);
    }
    Leaderboard.GoToSelf = GoToSelf;
    function GoToTop() {
        const elList = $.GetContextPanel().FindChildInLayoutFile('id-leaderboard-entries');
        $.DispatchEvent('ScrollToDelayLoadListItem', elList, 0, 'topleft', true);
    }
    Leaderboard.GoToTop = GoToTop;
    {
        $.RegisterEventHandler('ReadyForDisplay', $.GetContextPanel(), Leaderboard.ReadyForDisplay);
        $.RegisterEventHandler('UnreadyForDisplay', $.GetContextPanel(), Leaderboard.UnReadyForDisplay);
        _Init();
    }
})(Leaderboard || (Leaderboard = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVhZGVyYm9hcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9sZWFkZXJib2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsa0NBQWtDO0FBQ2xDLHlDQUF5QztBQUN6Qyw0Q0FBNEM7QUFDNUMsc0NBQXNDO0FBY3RDLE1BQU0sa0JBQWtCLEdBQThCO0lBQ3JELE1BQU0sRUFBRSxjQUFjO0lBQ3RCLE1BQU0sRUFBRSxjQUFjO0lBQ3RCLE1BQU0sRUFBRSxRQUFRO0lBQ2hCLE1BQU0sRUFBRSxNQUFNO0lBQ2QsTUFBTSxFQUFFLFdBQVc7SUFDbkIsTUFBTSxFQUFFLFFBQVE7SUFDaEIsSUFBSSxFQUFFLE9BQU87Q0FDYixDQUFBO0FBRUQsSUFBVSxXQUFXLENBZzBCcEI7QUFoMEJELFdBQVUsV0FBVztJQUVwQixTQUFTLElBQUksQ0FBRyxHQUFXO0lBRzNCLENBQUM7SUFFRCxJQUFJLG1CQUFtQixHQUFHLEtBQUssQ0FBQztJQUNoQyxJQUFJLFFBQVEsR0FBRyxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDdEMsSUFBSSxRQUEyQixDQUFDO0lBRWhDLElBQUksK0JBQXVDLENBQUM7SUFDNUMsSUFBSSxxQ0FBNkMsQ0FBQztJQUNsRCxJQUFJLG9DQUE0QyxDQUFDO0lBQ2pELElBQUksZ0NBQXdDLENBQUM7SUFDN0MsSUFBSSxzQkFBOEIsQ0FBQztJQUVuQyxJQUFJLGlCQUFpQixHQUFXLEVBQUUsQ0FBQztJQUVuQyxJQUFJLGdDQUFnQyxHQUFXLEVBQUUsQ0FBQztJQUVsRCxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUM7SUFDNUIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7SUFFOUIsU0FBZ0IscUJBQXFCO1FBRXBDLElBQUksQ0FBRSx1QkFBdUIsQ0FBRSxDQUFDO1FBRWhDLElBQUssQ0FBQyxtQkFBbUIsRUFDekI7WUFDQywrQkFBK0IsR0FBRyxD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