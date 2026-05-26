"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="matchlist.ts" />
/// <reference path="watchtile.ts" />
/// <reference path="common/commonutil.ts" />
/// <reference path="common/scheduler.ts" />
/// <reference path="common/licenseutil.ts" />
/// <reference path="common/iteminfo.ts" />
/// <reference path="common/formattext.ts" />
/// <reference path="generated/items_event_current_generated_store.ts" />
var mainmenu_watch;
(function (mainmenu_watch) {
    let _m_bPerfectWorld = (MyPersonaAPI.GetLauncherType() === 'perfectworld');
    let _m_activeTab;
    let _m_contextTab;
    let _m_tabStack = [];
    let _m_contextPanel;
    let _m_myXuid = MyPersonaAPI.GetXuid();
    let MATCHLISTDESCRIPTOR = {
        "JsLive": "live",
        "JsYourMatches": _m_myXuid,
        "JsDownloaded": "downloaded"
    };
    let MATCHLISTTABBYNAME = {
        "live": "JsLive",
        "downloaded": "JsDownloaded",
        [_m_myXuid]: "JsYourMatches"
    };
    function GetActiveTab() {
        return _m_activeTab;
    }
    mainmenu_watch.GetActiveTab = GetActiveTab;
    function _PopulateStreamList(parentPanel) {
        let streamNum = StreamsAPI.GetStreamCount();
        let count = 9;
        if (streamNum < 9) {
            count = streamNum;
        }
        let elStreamList = parentPanel.FindChildTraverse("JsStreamList");
        for (let i = 0; i < elStreamList.GetChildCount(); i++) {
            elStreamList.GetChild(i).Data().markForDelete = true;
        }
        if (count === 0) {
            matchList.ShowListSpinner(false, parentPanel);
            matchList.SetListMessage($.Localize("#CSGO_Watch_NoSteams"), true, parentPanel);
            matchList.ShowInfoPanel(false, parentPanel);
        }
        else {
            matchList.SetListMessage("", false, parentPanel);
            matchList.ShowInfoPanel(true, parentPanel);
        }
        function _SendToTwitch(streamId) {
            let url = StreamsAPI.GetStreamVideoFeedByName(streamId);
            SteamOverlayAPI.OpenExternalBrowserURL(url);
        }
        function _ClearList(elListPanel) {
            let activeTiles = elListPanel.Children();
            for (let i = activeTiles.length - 1; i >= 0; i--) {
                if (activeTiles[i].Data().markForDelete) {
                    if (elListPanel.Data().activeButton === activeTiles[i]) {
                        elListPanel.Data().activeButton = undefined;
                    }
                    activeTiles[i].checked = false;
                    watchTile.Delete(activeTiles[i]);
                }
            }
        }
        for (let i = 0; i < count; i++) {
            let streamName = StreamsAPI.GetStreamNameByIndex(i);
            let elStreamPanel = elStreamList.FindChildInLayoutFile("TwitchStream_" + streamName);
            if (elStreamPanel == undefined) {
                let elStreamPanel = $.CreatePanel('Button', elStreamList, "TwitchStream_" + streamName);
                let streamCountry = StreamsAPI.GetStreamCountryByName(streamName);
                elStreamPanel.BLoadLayout("file://{resources}/layout/matchtiles/streams.xml", false, false);
                let elStreamText = elStreamPanel.FindChildTraverse('Text-Panel');
                elStreamPanel.FindChildInLayoutFile('stream-button__blur-target').AddBlurPanel(elStreamText);
                elStreamPanel.SetDialogVariable('streamText', StreamsAPI.GetStreamTextDescriptionByName(streamName));
                elStreamPanel.SetDialogVariable("numberOfViewers", (StreamsAPI.GetStreamViewersByName(streamName)).toString());
                elStreamPanel.SetDialogVariable("channel", StreamsAPI.GetStreamDisplayNameByName(streamName));
                elStreamPanel.FindChildTraverse("TwitchThumb").SetImage(StreamsAPI.GetStreamPreviewImageByName(streamName));
                CommonUtil.SetLanguageOnLabel(streamCountry, elStreamPanel);
                elStreamPanel.SetPanelEvent('onactivate', _SendToTwitch.bind(undefined, streamName));
            }
            elStreamPanel.Data().markForDelete = false;
        }
        _ClearList(parentPanel.FindChildTraverse("JsStreamList"));
    }
    function _OnMouseOverTextTooltip(_panel, _text) {
        UiToolkitAPI.ShowTextTooltip(_panel, _text);
    }
    function _OnMouseOutTextTooltip() {
        UiToolkitAPI.HideTextTooltip();
    }
    function _PopulateTournamentPage(parentPanel) {
        let elTournamentList = parentPanel.FindChildTraverse("JsTournamentList");
        if (!elTournamentList.FindChildTraverse("other-tournaments")) {
            elTournamentList.BLoadLayout("file://{resources}/layout/matchtiles/tournament_page.xml", false, false);
            let pastTournamentPanel = elTournamentList.FindChildTraverse("other-tournaments");
            let maxTournaments = g_ActiveTournamentInfo.eventid;
            for (let i = maxTournaments; i >= 1; i--) {
                if (i == 2)
                    continue;
                if (i == 17)
                    continue;
                let elTournamentPanel = $.CreatePanel('Panel', pastTournamentPanel, "Tournament_" + i);
                elTournamentPanel.BLoadLayoutSnippet("tournament_tile");
                elTournamentPanel.SetDialogVariable('tournament-title', $.Localize('#CSGO_Tournament_Event_Location_' + i));
                let elTOLogo = elTournamentPanel.FindChildTraverse('id-tournament-to-logo');
                elTOLogo.SetImage('file://{images}/tournaments/events/tournament_logo_' + i + '.svg');
                elTOLogo.GetParent().SetHasClass('tall-logo', i == 22 || i == 24 || i == 25);
                let ProEventJSO = TournamentsAPI.GetProEventDataJSO(i, 8);
                let oWinningTeam;
                let hasEventData = false;
                if (ProEventJSO
                    && ProEventJSO.hasOwnProperty('eventdata')
                    && ProEventJSO['eventdata'].hasOwnProperty(i)) {
                    oWinningTeam = ProEventJSO['eventdata'][i][0];
                    hasEventData = true;
                }
                let elChampions = elTournamentPanel.FindChildTraverse('JsChampions');
                _SetTeam(elChampions, oWinningTeam, i, false);
                let elLegendsContainer = elTournamentPanel.FindChildTraverse('JsLegendsContainer');
                let elPlayerRoot = elTournamentPanel.FindChildTraverse("JsPlayersContainer");
                let elHoverPanel = elTournamentPanel.FindChildTraverse('JsChampionsHoverTarget');
                _PopulateTeamPlayers(elPlayerRoot, elHoverPanel, elLegendsContainer, oWinningTeam, i);
                for (let iTeam = 1; iTeam < 8; iTeam++) {
                    let oTeam;
                    if (hasEventData &&
                        ProEventJSO['eventdata'][i].hasOwnProperty(iTeam) &&
                        ProEventJSO['eventdata'][i][iTeam]) {
                        oTeam = ProEventJSO['eventdata'][i][iTeam];
                    }
                    let elLegend = $.CreatePanel('Panel', elLegendsContainer, iTeam.toString());
                    elLegend.BLoadLayoutSnippet("snippet-tournament-legends");
                    _SetTeam(elLegend, oTeam, i);
                }
                let elModel = elTournamentPanel.FindChildTraverse('ParticleModel');
                elModel.StopParticlesImmediately(true);
                elModel.StartParticles();
                elModel.SetControlPoint(4, 0, 0, -80);
                let elButton = elTournamentPanel.FindChild('JsTournamentContent');
                let image = 'url("file://{images}/tournaments/events/bg_' + i + '.png")';
                if (elButton?.IsValid() && elButton) {
                    elButton.style.backgroundImage = image;
                    elButton.style.backgroundPosition = '50% 50%';
                    elButton.style.backgroundSize = 'auto 110%';
                    elButton.style.backgroundImgOpacity = '.7';
                    if (i == maxTournaments) {
                        elButton.SetPanelEvent('onactivate', () => {
                            UiToolkitAPI.ShowCustomLayoutPopupParameters('id-popup-major-hub', 'file://{resources}/layout/popups/popup_major_hub.xml', 'eventid=' + i);
                        });
                    }
                }
            }
        }
        function _SetTeam(elTeam, oTeamData, uniqueIdentifier, bTooltip = true) {
            let elTeamLogo = elTeam.FindChildTraverse('JsTeamLogo');
            let teamName = $.Localize("#CSGO_PickEm_Team_TBD");
            let teamPlaceStr = "";
            if (oTeamData) {
                let team = oTeamData['team_id'];
                let teamTag = oTeamData['tag'];
                let teamGeo = oTeamData['geo'];
                let teamPlaceToken = oTeamData['place_token'];
                let teamLogo = 'file://{images}/tournaments/teams/' + teamTag.toLowerCase() + '.svg';
                teamName = $.Localize('#CSGO_TeamID_' + team);
                teamPlaceStr = $.Localize(teamPlaceToken);
                elTeamLogo.SetImage(teamLogo);
                if (bTooltip) {
                    let TooltipString = $.Localize(teamName);
                    let elTooltipAnchor = $.CreatePanel("Panel", elTeam, uniqueIdentifier + "_" + elTeam.id, { style: "	tooltip-position: bottom;" });
                }
            }
            elTeam.SetDialogVariable("team-place", teamPlaceStr);
            elTeam.SetDialogVariable("team-name", teamName);
        }
        function _PopulateTeamPlayers(elPlayerContainer, elHoverPanel, elLegendsContainer, oTeamData, eventid) {
            if (!oTeamData)
                return;
            let arrIndices = [0, 1, 2, 3, 4];
            for (let i = 0; i < 5; i++) {
                let n = arrIndices.splice(Math.floor(Math.random() * 5), 1)[0];
                arrIndices.push(n);
            }
            let arrTeamPlayers = Object.entries(oTeamData['players']);
            arrIndices.forEach(function (i) {
                let oPlayer = arrTeamPlayers[i][1];
                let elPlayer = $.CreatePanel('Panel', elPlayerContainer, 'JsPlayerCard');
                elPlayer.BLoadLayoutSnippet('snippet-tournament-player');
                elPlayer.SetDialogVariable('tournament-player-name', oPlayer['name']);
                let elPlayerImage = elPlayer.FindChildTraverse('JsTournamentPlayerPhoto');
                if (elPlayerImage) {
                    let photo_url = "file://{images}/tournaments/avatars/" + eventid + "/" + oPlayer['accountid64'] + ".png";
                    elPlayerImage.SetImage(photo_url);
                }
            });
            elHoverPanel.AddClass("has-team-data");
            elHoverPanel.SetPanelEvent('onmouseover', function (elPlayerContainer, elLegendsContainer) { _RevealPlayers(elPlayerContainer, elLegendsContainer); }.bind(undefined, elPlayerContainer, elLegendsContainer));
            elHoverPanel.SetPanelEvent('onmouseout', function (elPlayerContainer, elLegendsContainer) { _HidePlayers(elPlayerContainer, elLegendsContainer); }.bind(undefined, elPlayerContainer, elLegendsContainer));
            function _RevealPlayers(elPlayerContainer, elLegendsContainer) {
                let arrElPlayers = elPlayerContainer.Children();
                elLegendsContainer.AddClass('hidden');
                const DELAY_INIT = 0;
                const DELAY_DELTA = 0.1;
                arrElPlayers.forEach(function (elPlayer, i) {
                    let delay = DELAY_INIT + i * DELAY_DELTA;
                    Scheduler.Schedule(delay, () => {
                        if (elPlayer && elPlayer.IsValid())
                            elPlayer.RemoveClass('hidden');
                        Scheduler.Schedule(0.1, function () {
                            $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.mainmenu_rollover', 'MOUSE');
                        }, "player-reveal");
                    }, "player-reveal");
                });
            }
            function _HidePlayers(elPlayerContainer, elLegendsContainer) {
                elLegendsContainer.RemoveClass('hidden');
                let arrElPlayers = elPlayerContainer.Children();
                Scheduler.Cancel("player-reveal");
                arrElPlayers.forEach(function (elPlayer) {
                    elPlayer.AddClass('hidden');
                });
            }
        }
    }
    function _UpdateTab(elTab, optbFromMatchListChangeEvent = false) {
        elTab.SetReadyForDisplay(true);
        elTab.visible = true;
        switch (elTab.id) {
            case "JsTournaments":
                _PopulateTournamentPage(elTab);
                break;
            case "JsYourMatches":
            case "JsDownloaded":
            case "JsLive":
                matchList.UpdateMatchList(elTab, MATCHLISTDESCRIPTOR[elTab.id], optbFromMatchListChangeEvent);
                break;
            case "JsEvents":
                TournamentsAPI.RequestTournaments();
                break;
        }
    }
    function UpdateActiveTab() {
        if (_m_activeTab) {
            if (_m_activeTab.id === 'JsActiveTournament') {
                $.DispatchEvent('RefreshPickemPage', 'tournament:' + g_ActiveTournamentInfo.eventid);
                return;
            }
            _UpdateTab(_m_activeTab);
        }
    }
    mainmenu_watch.UpdateActiveTab = UpdateActiveTab;
    function _UpdateMatchList(listId, optbFromMatchListChangeEvent) {
        let tabbyid = MATCHLISTTABBYNAME[listId];
        if (tabbyid) {
            _UpdateTab($("#" + tabbyid), optbFromMatchListChangeEvent);
        }
    }
    function _UpdateMatchListFromMatchListChangeEvent(listId) {
        _UpdateMatchList(listId, true);
    }
    function NavigateToTab(tab = '', xmlName = '', tournament_id = '', isSubTab = false, addToStack = false) {
        if (isSubTab && addToStack) {
            if (_m_tabStack.length > 0) {
                _m_tabStack[_m_tabStack.length - 1].AddClass("mainmenu-content--hidden");
            }
            else {
                if (!_m_contextPanel) {
                    _m_contextPanel = $("#main-content");
                }
                if (_m_contextPanel) {
                    _m_contextPanel.AddClass("mainmenu-content--hidden");
                }
            }
        }
        let parent = $.GetContextPanel().FindChildInLayoutFile(tab);
        if (isSubTab && !parent) {
            let newPanel = undefined;
            parent = $.CreatePanel('Panel', $('#JsWatchContent'), tab);
            parent.AddClass("mainmenu-content--popuptab");
            parent.AddClass("mainmenu-content--hidden");
            parent.AddClass("mainmenu-content__container");
            parent.AddClass("no-margin");
            parent.AddClass('hide');
            newPanel = $.CreatePanel('Panel', parent, "tournament_content_" + tournament_id);
            newPanel.Data().elMainMenuRoot = $.GetContextPanel().Data().elMainMenuRoot;
            parent.RemoveClass('hide');
            parent.RemoveClass('mainmenu-content--hidden');
            parent.Data().tournament_id = tournament_id;
            newPanel.BLoadLayout('file://{resources}/layout/' + xmlName + '.xml', false, false);
            newPanel.RegisterForReadyEvents(true);
            parent.Data().isSubTab = true;
            _InitResourceManagement(newPanel);
            $.DispatchEvent('InitializeTournamentsPage', newPanel, tournament_id);
        }
        let pressedTab = $('#' + tab);
        if (_m_activeTab != pressedTab) {
            if (!isSubTab) {
                if (_m_activeTab) {
                    if (!_m_activeTab.Data().isSubTab) {
                        _m_activeTab.AddClass('WatchMenu--Hide');
                    }
                    else {
                        _m_activeTab.AddClass('mainmenu-content--hidden');
                    }
                }
                _m_activeTab = pressedTab;
                _m_contextTab = pressedTab;
                if (!_m_contextPanel) {
                    _m_contextPanel = $("#main-content");
                }
                if (_m_contextPanel) {
                    _m_contextPanel.RemoveClass("mainmenu-content--hidden");
                }
                if (!_m_activeTab) {
                    return;
                }
                _m_activeTab.RemoveClass('WatchMenu--Hide');
            }
            else {
                if (!addToStack)
                    _m_activeTab.AddClass('mainmenu-content--hidden');
                _m_activeTab = pressedTab;
                _m_activeTab.SetFocus();
                if (!_m_activeTab) {
                    return;
                }
                _m_activeTab.RemoveClass('mainmenu-content--hidden');
                if (_m_activeTab.Data().tournament_id) {
                    matchList.ReselectActiveTile(_m_activeTab);
                }
                if (addToStack)
                    _m_tabStack.push(_m_activeTab);
            }
        }
        _UpdateTab(_m_activeTab);
    }
    mainmenu_watch.NavigateToTab = NavigateToTab;
    function CloseSubMenuContent() {
        if ((!_m_tabStack) || (_m_tabStack.length == 0) || (!_m_tabStack[_m_tabStack.length - 1].visible)) {
            return false;
        }
        _m_tabStack.pop();
        if (_m_tabStack.length >= 1) {
            NavigateToTab(_m_tabStack[_m_tabStack.length - 1].id, undefined, undefined, false);
        }
        else {
            NavigateToTab(_m_contextTab.id);
        }
        return true;
    }
    mainmenu_watch.CloseSubMenuContent = CloseSubMenuContent;
    function _InitResourceManagement(elTab) {
        $.RegisterEventHandler('PropertyTransitionEnd', elTab, (panelName, propertyName) => {
            if (elTab === panelName && propertyName === 'opacity') {
                if (elTab.visible === true && elTab.BIsTransparent()) {
                    elTab.visible = false;
                    elTab.SetReadyForDisplay(false);
                    return true;
                }
            }
            return false;
        });
        elTab.Data().elMainMenuRoot = $.GetContextPanel().Data().elMainMenuRoot;
    }
    function _InitTab(tab) {
        let elTab = $('#' + tab);
        if (!elTab.BLoadLayoutSnippet("MatchListAndInfo")) {
        }
        _InitResourceManagement(elTab);
    }
    function InitMainWatchPanel() {
        _m_activeTab = null;
        _m_contextPanel = $("#main-content");
        $.RegisterForUnhandledEvent("PanoramaComponent_MatchList_StateChange", _UpdateMatchListFromMatchListChangeEvent);
        $.RegisterForUnhandledEvent("CloseSubMenuContent", CloseSubMenuContent);
        $.RegisterForUnhandledEvent("NavigateToTab", NavigateToTab);
        _InitTab('JsYourMatches');
        _InitTab('JsDownloaded');
        _InitTab('JsLive');
        _InitResourceManagement($('#JsTournaments'));
        if (_m_bPerfectWorld) {
            let elWatchNavBarButtonStreams = $('#WatchNavBarButtonStreams');
            if (elWatchNavBarButtonStreams)
                elWatchNavBarButtonStreams.DeleteAsync(.0);
            elWatchNavBarButtonStreams = $('#WatchNavBarButtonEvents');
            if (elWatchNavBarButtonStreams)
                elWatchNavBarButtonStreams.DeleteAsync(.0);
        }
        else {
            _InitResourceManagement($('#JsEvents'));
        }
        let restrictions = LicenseUtil.GetCurrentLicenseRestrictions();
        if (restrictions === false) {
        }
        NavigateToTab('JsYourMatches');
        $('#WatchNavBarYourMatches').checked = true;
    }
    mainmenu_watch.InitMainWatchPanel = InitMainWatchPanel;
    let _RunEveryTimeWatchIsShown = function () {
        if (!MyPersonaAPI.IsInventoryValid() || !MyPersonaAPI.IsConnectedToGC()) {
            UiToolkitAPI.ShowGenericPopupOk($.Localize('#SFUI_SteamConnectionErrorTitle'), $.Localize('#SFUI_Steam_Error_LinkUnexpected'), '', function () {
                $.DispatchEvent('HideContentPanel');
            });
        }
    };
    function OnReadyForDisplay() {
    }
    mainmenu_watch.OnReadyForDisplay = OnReadyForDisplay;
    ;
    function ShowActiveTournamentPage(idOfTab = '') {
        while (CloseSubMenuContent())
            continue;
        NavigateToTab('JsTournaments');
        $('#WatchNavBarButtonTournaments').checked = true;
        let i = g_ActiveTournamentInfo.eventid;
        NavigateToTab('JsMainMenuSubContent_Tournament' + i, 'mainmenu_watch_tournament', 'tournament:' + i, true, true);
        let elTournamentActive = _m_activeTab;
        if (idOfTab && elTournamentActive) {
            let elTabToActivate = elTournamentActive.FindChildTraverse('content-navbar__tabs');
            if (elTabToActivate) {
                elTabToActivate = elTabToActivate.FindChildInLayoutFile(idOfTab);
            }
            if (elTabToActivate) {
                $.DispatchEvent("Activated", elTabToActivate, "mouse");
            }
            else {
            }
        }
    }
    mainmenu_watch.ShowActiveTournamentPage = ShowActiveTournamentPage;
})(mainmenu_watch || (mainmenu_watch = {}));
(function () {
    $.RegisterEventHandler('Cancelled', $('#JsWatch'), mainmenu_watch.CloseSubMenuContent);
    $.RegisterEventHandler('ReadyForDisplay', $('#JsWatch'), mainmenu_watch.OnReadyForDisplay);
    $.RegisterForUnhandledEvent('ShowActiveTournamentPage', mainmenu_watch.ShowActiveTournamentPage);
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbm1lbnVfd2F0Y2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9tYWlubWVudV93YXRjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsa0NBQWtDO0FBQ2xDLHFDQUFxQztBQUNyQyxxQ0FBcUM7QUFDckMsNkNBQTZDO0FBQzdDLDRDQUE0QztBQUM1Qyw4Q0FBOEM7QUFDOUMsMkNBQTJDO0FBQzNDLDZDQUE2QztBQUM3Qyx5RUFBeUU7QUFJekUsSUFBVSxjQUFjLENBc3RCdkI7QUF0dEJELFdBQVUsY0FBYztJQUV2QixJQUFJLGdCQUFnQixHQUFHLENBQUUsWUFBWSxDQUFDLGVBQWUsRUFBRSxLQUFLLGNBQWMsQ0FBRSxDQUFDO0lBQzdFLElBQUksWUFBNEIsQ0FBQztJQUNqQyxJQUFJLGFBQXNCLENBQUM7SUFDM0IsSUFBSSxXQUFXLEdBQVksRUFBRSxDQUFDO0lBQzlCLElBQUksZUFBd0IsQ0FBQztJQUM3QixJQUFJLFNBQVMsR0FBVyxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDL0MsSUFBSSxtQkFBbUIsR0FBRztRQUN6QixRQUFRLEVBQUUsTUFBTTtRQUNoQixlQUFlLEVBQUUsU0FBUztRQUMxQixjQUFjLEVBQUUsWUFBWTtLQUM1QixDQUFDO0lBQ0YsSUFBSSxrQkFBa0IsR0FBdUI7UUFDNUMsTUFBTSxFQUFFLFFBQVE7UUFDaEIsWUFBWSxFQUFFLGNBQWM7UUFDNUIsQ0FBQyxTQUFTLENBQUMsRUFBRSxlQUFlO0tBQzVCLENBQUM7SUFFQyxTQUFnQixZQUFZO1FBRXhCLE9BQU8sWUFBWSxDQUFDO0lBQ3hCLENBQUM7SUFIZSwyQkFBWSxlQUczQixDQUFBO0lBTUosU0FBUyxtQkFBbUIsQ0FBRyxXQUFvQjtRQUdsRCxJQUFJLFNBQVMsR0FBRyxVQUFVLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDNUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFD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