"use strict";
/// <reference path="csgo.d.ts" />
/// <reference path="mock_adapter.ts" />
/// <reference path="common/gamerules_constants.ts" />
/// <reference path="common/formattext.ts" />
/// <reference path="rating_emblem.ts" />
/// <reference path="match_stakes.ts" />
/// <reference path="honor_icon.ts" />
/// <reference path="context_menus/context_menu_playercard.ts" />
var Scoreboard;
(function (Scoreboard) {
    const _m_cP = $.GetContextPanel();
    let _m_LocalPlayerID = '';
    function GetLocalPlayerId() {
        if (_m_LocalPlayerID === '')
            _m_LocalPlayerID = GameStateAPI.GetLocalPlayerXuid();
        return _m_LocalPlayerID;
    }
    class Team_t {
        m_CommendLeaderboards = {
            'leader': [],
            'teacher': [],
            'friendly': [],
        };
        m_teamName;
        constructor(teamName) {
            this.m_teamName = teamName;
        }
        CalculateAllCommends() {
            for (let stat of ['leader', 'teacher', 'friendly']) {
                this._SortCommendLeaderboard(stat);
                this._ChangeCommendDisplay(_m_TopCommends[stat], stat, false);
                _m_TopCommends[stat] = this._GetCommendBestXuid(stat);
                this._ChangeCommendDisplay(_m_TopCommends[stat], stat, true);
            }
        }
        UpdateCommendForPlayer(xuid, stat, value) {
            if (value == 0)
                return;
            let playerCommend = this.m_CommendLeaderboards[stat].find(p => p.m_xuid === xuid);
            if (!playerCommend) {
                this.m_CommendLeaderboards[stat].push({ m_xuid: xuid, m_value: value });
            }
            else {
                playerCommend.m_value = value;
            }
        }
        DeletePlayerFromCommendsLeaderboards(xuid) {
            for (let stat of ['leader', 'teacher', 'friendly']) {
                let index = this.m_CommendLeaderboards[stat].findIndex(p => p.m_xuid === xuid);
                if (index != -1) {
                    this.m_CommendLeaderboards[stat].splice(index, 1);
                }
            }
        }
        _ChangeCommendDisplay(xuid, stat, turnon) {
            let oPlayer = _m_oPlayers.GetPlayerByXuid(xuid);
            if (!oPlayer)
                return;
            let elPlayer = oPlayer.m_elPlayer;
            if (!elPlayer || !elPlayer.IsValid())
                return;
            let elCommendationImage = elPlayer.FindChildTraverse('id-sb-name__commendations__' + stat);
            if (!elCommendationImage || !elCommendationImage.IsValid())
                return;
            elCommendationImage.SetHasClass('hidden', !turnon);
        }
        _SortCommendLeaderboard(stat) {
            this.m_CommendLeaderboards[stat].sort((a, b) => b.m_value - a.m_value);
        }
        _GetCommendBestXuid(stat) {
            switch (stat) {
                case 'leader': return this._GetCommendTopLeaderXuid();
                case 'teacher': return this._GetCommendTopTeacherXuid();
                case 'friendly': return this._GetCommendTopFriendlyXuid();
                default: return "0";
            }
        }
        _GetCommendTopLeaderXuid() {
            let clb = this.m_CommendLeaderboards['leader'];
            return clb[0] ? clb[0].m_xuid : "0";
        }
        _GetCommendTopTeacherXuid() {
            let clb = this.m_CommendLeaderboards['teacher'];
            let teacher0 = clb[0] ? clb[0].m_xuid : "0";
            let teacher1 = clb[1] ? clb[1].m_xuid : "0";
            if (teacher0 != this._GetCommendTopLeaderXuid())
                return teacher0;
            else
                return teacher1;
        }
        _GetCommendTopFriendlyXuid() {
            let clb = this.m_CommendLeaderboards['friendly'];
            let friendly0 = clb[0] ? clb[0].m_xuid : "0";
            let friendly1 = clb[1] ? clb[1].m_xuid : "0";
            let friendly2 = clb[2] ? clb[2].m_xuid : "0";
            if (friendly0 != this._GetCommendTopLeaderXuid() && friendly0 != this._GetCommendTopTeacherXuid())
                return friendly0;
            else if (friendly1 != this._GetCommendTopLeaderXuid() && friendly1 != this._GetCommendTopTeacherXuid())
                return friendly1;
            else
                return friendly2;
        }
    }
    class Player_t {
        m_xuid;
        m_elPlayer = undefined;
        m_elTeam = undefined;
        m_oStats = {};
        m_oElStats = {};
        m_isMuted = false;
        m_oMatchStats = undefined;
        m_xp_trail_level;
        constructor(xuid) {
            this.m_xuid = xuid;
        }
        GetStatNum(stat, dflt = 0) {
            const val = this.m_oStats[stat];
            return typeof val === "number" && isFinite(val) ? val : dflt;
        }
        GetStatText(stat, dflt = "") {
            const val = this.m_oStats[stat];
            return typeof val === "string" ? val : val != null ? val.toString() : dflt;
        }
    }
    class AllPlayers_t {
        m_arrPlayers = [];
        AddPlayer(xuid) {
            let newPlayer = new Player_t(xuid);
            let teamName = GameStateAPI.GetPlayerTeamName(xuid);
            if (IsTeamASpecTeam(teamName))
                teamName = 'Spectator';
            let elTeam = _m_cP.FindChildInLayoutFile('players-table-' + teamName);
            if (!elTeam || !elTeam.IsValid()) {
                elTeam = _m_cP.FindChildInLayoutFile('players-table-ANY');
            }
            newPlayer.m_elTeam = elTeam;
            this.m_arrPlayers.push(newPlayer);
            return newPlayer;
        }
        GetPlayerByIndex(i) {
            return this.m_arrPlayers[i];
        }
        GetPlayerByXuid(xuid) {
            return this.m_arrPlayers.find(p => p.m_xuid === xuid);
        }
        GetPlayerIndexByPlayerSlot(slot) {
            let xuid = GameStateAPI.GetPlayerXuidStringFromPlayerSlot(slot);
            return this.GetPlayerIndexByXuid(xuid);
        }
        GetPlayerIndexByXuid(xuid) {
            return this.m_arrPlayers.findIndex(p => p.m_xuid === xuid);
        }
        GetCount() {
            return this.m_arrPlayers.length;
        }
        DeletePlayerByXuid(xuid) {
            let oPlayer = this.GetPlayerByXuid(xuid);
            const teamName = oPlayer?.m_oStats?.teamname;
            if (teamName && _m_oTeams[teamName]) {
                _m_oTeams[teamName].DeletePlayerFromCommendsLeaderboards(xuid);
            }
            let i = this.GetPlayerIndexByXuid(xuid);
            if (this.m_arrPlayers[i].m_elPlayer && this.m_arrPlayers[i].m_elPlayer.IsValid()) {
                this.m_arrPlayers[i].m_elPlayer.DeleteAsync(.0);
            }
            this.m_arrPlayers.splice(i, 1);
        }
        DeleteMissingPlayers(oPlayerList) {
            const players = Object.values(oPlayerList).flatMap(team => Object.values(team ?? {}));
            const sXuids = new Set(players.filter(xuid => !!xuid));
            for (const player of this.m_arrPlayers) {
                if (!sXuids.has(player.m_xuid)) {
                    this.DeletePlayerByXuid(player.m_xuid);
                }
            }
        }
    }
    let _m_bInit = false;
    let _m_oUpdateStatFns = {};
    let _m_updatePlayerIndex = 0;
    let _m_oTeams = {};
    let _m_arrSortingPausedRefGetCounter = 0;
    let _m_hDenyInputToGame = null;
    let _m_dataSetCurrent = 0;
    let _m_dataSetGetCount = 0;
    let _m_areTeamsSwapped = false;
    let _m_maxRounds = 0;
    let _m_oPlayers;
    let _m_RoundUpdated = {};
    let _m_TopCommends = {
        'leader': "0",
        'teacher': "0",
        'friendly': "0",
    };
    let _m_overtime = 0;
    let _m_updatePlayerHandler = null;
    let _m_haveViewers = false;
    let FAKEMODE = '';
    const sortOrder_default = {
        'dc': 0,
        'score': 0,
        'risc': 0,
        'mvps': 0,
        'kills': 0,
        'assists': 0,
        'deaths': -1,
        'leader': 0,
        'teacher': 0,
        'friendly': 0,
        'rank': 0,
        'idx': -1,
        'damage': 0,
        'avgrisc': 0,
        'money': 0,
        'hsp': 0,
        'kdr': 0,
        'adr': 0,
        'utilitydamage': 0,
        'enemiesflashed': 0,
    };
    const sortOrder_reverse = {
        'dc': 0,
        'score': -1,
        'risc': -1,
        'mvps': -1,
        'kills': -1,
        'assists': -1,
        'deaths': 0,
        'leader': -1,
        'teacher': -1,
        'friendly': -1,
        'rank': -1,
        'idx': 0,
        'damage': 0,
        'avgrisc': 0,
        'money': 0,
        'hsp': 0,
        'kdr': 0,
        'adr': 0,
        'utilitydamage': 0,
        'enemiesflashed': 0,
    };
    const sortOrder_dm = {
        'dc': 0,
        'score': 0,
        'kills': 0,
        'kdr': 0,
        'damage': 0,
        'hsp': 0,
        'idx': -1,
        'assists': 0,
        'deaths': -1,
    };
    const sortOrder_gg = {
        'dc': 0,
        'gglevel': 0,
        'knifekills': 0,
        'taserkills': 0,
        'kills': 0,
        'kdr': 0,
        'hsp': 0,
        'idx': -1,
        'assists': 0,
        'deaths': -1,
    };
    const sortOrder_tmm = {
        'dc': 0,
        'damage': 0,
        'kills': 0,
        'risc': 0,
        'mvps': 0,
        'assists': 0,
        'deaths': -1,
        'leader': 0,
        'teacher': 0,
        'friendly': 0,
        'rank': 0,
        'idx': -1,
        'score': 0,
        'avgrisc': 0,
        'money': 0,
        'hsp': 0,
        'kdr': 0,
        'adr': 0,
        'utilitydamage': 0,
        'enemiesflashed': 0,
    };
    let _m_sortOrder = sortOrder_default;
    _Reset();
    function _Reset() {
        _m_bInit = false;
        _m_oPlayers = new AllPlayers_t();
        _m_oUpdateStatFns = {};
        _m_updatePlayerIndex = 0;
        _m_oTeams = {};
        _m_arrSortingPausedRefGetCounter = 0;
        _m_hDenyInputToGame = null;
        _m_dataSetCurrent = 0;
        _m_dataSetGetCount = 0;
        _m_areTeamsSwapped = false;
        _m_maxRounds = 0;
        _m_sortOrder = sortOrder_default;
        _m_overtime = 0;
        _m_RoundUpdated = {};
        _m_TopCommends = {
            'leader': "0",
            'teacher': "0",
            'friendly': "0",
        };
        _m_cP.RemoveAndDeleteChildren();
        _m_cP.m_bSnippetLoaded = false;
    }
    function _Helper_LoadSnippet(element, snippet) {
        if (element && !element.m_bSnippetLoaded) {
            element.BLoadLayoutSnippet(snippet);
            element.m_bSnippetLoaded = true;
        }
    }
    function _PopulatePlayerList() {
        const playerData = GameStateAPI.GetPlayerDataJSO();
        const teamNames = Object.keys(playerData);
        if (teamNames.length === 0)
            return;
        _m_oPlayers.DeleteMissingPlayers(playerData);
        for (const teamName of teamNames) {
            CreateTeam(teamName);
            for (const xuid of Object.values(playerData[teamName])) {
                if (xuid == null || xuid === "0")
                    continue;
                const oPlayer = _m_oPlayers.GetPlayerByXuid(xuid);
                if (!oPlayer) {
                    _CreateNewPlayer(xuid);
                }
                else if (oPlayer.m_oStats['teamname'] != teamName) {
                    _ChangeTeams(oPlayer, teamName);
                }
            }
        }
        CreateTeam('CT');
        CreateTeam('TERRORIST');
        function CreateTeam(teamName) {
            if (!_m_oTeams[teamName])
                _m_oTeams[teamName] = new Team_t(teamName);
        }
    }
    function _ChangeTeams(oPlayer, newTeam) {
        if (oPlayer.m_oStats['teamname'] == newTeam)
            return;
        let xuid = oPlayer.m_xuid;
        let oldTeam = oPlayer.m_oStats['teamname'];
        let elPlayer = oPlayer.m_elPlayer;
        oPlayer.m_oStats['teamname'] = newTeam;
        if (oldTeam in _m_oTeams) {
            _m_oTeams[oldTeam].DeletePlayerFromCommendsLeaderboards(xuid);
        }
        oPlayer.m_oStats['leader'] = -1;
        oPlayer.m_oStats['teacher'] = -1;
        oPlayer.m_oStats['friendly'] = -1;
        if (!elPlayer || !elPlayer.IsValid())
            return;
        if (oldTeam)
            elPlayer.RemoveClass('sb-team--' + oldTeam);
        elPlayer.AddClass('sb-team--' + newTeam);
        if (IsTeamASpecTeam(newTeam) && MatchStatsAPI.IsTournamentMatch()) {
            elPlayer.AddClass('hidden');
            return;
        }
        let elTeam = _m_cP.FindChildInLayoutFile('players-table-' + newTeam);
        if (!elTeam && !IsTeamASpecTeam(newTeam)) {
            elTeam = _m_cP.FindChildInLayoutFile('players-table-ANY');
        }
        if (elTeam && elTeam.IsValid()) {
            oPlayer.m_elTeam = elTeam;
            elPlayer.SetParent(elTeam);
            elPlayer.RemoveClass('hidden');
        }
        else {
            elPlayer.AddClass('hidden');
        }
        let idx = _m_oPlayers.GetPlayerIndexByXuid(xuid);
        _UpdateAllStatsForPlayer(idx, true);
        _SortPlayer(idx);
    }
    function _CreateNewPlayer(xuid) {
        let oPlayer = _m_oPlayers.AddPlayer(xuid);
        _NewPlayerPanel(oPlayer);
        let idx = _m_oPlayers.GetPlayerIndexByXuid(xuid);
        _UpdateAllStatsForPlayer(idx, true);
        _SortPlayer(idx);
        let sortOrder = Object.keys(_m_sortOrder)[1];
        _HighlightSortStatLabel(sortOrder);
    }
    function _UpdateNextPlayer() {
        _m_oPlayers.DeleteMissingPlayers(GameStateAPI.GetPlayerDataJSO());
        if (_m_updatePlayerIndex >= _m_oPlayers.GetCount()) {
            _PopulatePlayerList();
            _m_updatePlayerIndex = 0;
        }
        _UpdatePlayer(_m_updatePlayerIndex);
        _m_updatePlayerIndex++;
    }
    function _UpdateAllPlayers_delayed(bSilent = false) {
        $.Schedule(0.01, () => _UpdateAllPlayers(bSilent));
    }
    function _UpdateAllPlayers(bSilent) {
        if (!_m_bInit)
            return;
        _PopulatePlayerList();
        _m_updatePlayerIndex = 0;
        for (let i = 0; i < _m_oPlayers.GetCount(); i++) {
            let elPlayer = _m_oPlayers.GetPlayerByIndex(i).m_elPlayer;
            if (elPlayer && elPlayer.IsValid())
                elPlayer.RemoveClass('sb-row--transition');
        }
        for (let i = 0; i < _m_oPlayers.GetCount(); i++) {
            _UpdatePlayer(i, bSilent);
        }
        for (let i = 0; i < _m_oPlayers.GetCount(); i++) {
            let elPlayer = _m_oPlayers.GetPlayerByIndex(i).m_elPlayer;
            if (elPlayer && elPlayer.IsValid())
                elPlayer.AddClass('sb-row--transition');
        }
    }
    function _Pulse(el) {
        el.RemoveClass('sb-pulse-highlight');
        el.AddClass('sb-pulse-highlight');
    }
    function _UpdatePlayerByPlayerSlot(slot) {
        let index = _m_oPlayers.GetPlayerIndexByPlayerSlot(slot);
        _UpdatePlayer(index, true);
    }
    function _UpdatePlayerByPlayerSlot_delayed(slot) {
        $.Schedule(0.01, () => _UpdatePlayerByPlayerSlot(slot));
    }
    function _UpdatePlayer(idx, bSilent = false) {
        let oPlayer = _m_oPlayers.GetPlayerByIndex(idx);
        if (!oPlayer)
            return;
        bSilent = bSilent && _m_cP.visible;
        let xuid = oPlayer.m_xuid;
        oPlayer.m_oMatchStats = MatchStatsAPI.GetPlayerStatsJSO(xuid);
        _UpdateAllStatsForPlayer(idx, bSilent);
        _SortPlayer(idx);
    }
    function _UpdateSpectatorButtons() {
        let elButtonPanel = $('#spec-button-group');
        if (!elButtonPanel || !elButtonPanel.IsValid())
            return;
        let nCameraMan = parseInt(GameInterfaceAPI.GetSettingString('spec_autodirector_cameraman'));
        let bQ = (GameStateAPI.IsLocalPlayerHLTV() && nCameraMan > -1);
        if (bQ) {
            elButtonPanel.visible = true;
            UpdateCasterButtons();
        }
        else {
            elButtonPanel.visible = false;
        }
    }
    function _lessthan(x, y) {
        x = Number(x);
        y = Number(y);
        if (isNaN(x))
            return (!isNaN(y));
        if (isNaN(y))
            return false;
        return (x < y);
    }
    function _SortPlayer(idx) {
        if (_m_arrSortingPausedRefGetCounter != 0)
            return;
        let oPlayer = _m_oPlayers.GetPlayerByIndex(idx);
        let elTeam = oPlayer.m_elTeam;
        if (!elTeam || !elTeam.IsValid())
            return;
        let elPlayer = oPlayer.m_elPlayer;
        if (!elPlayer || !elPlayer.IsValid())
            return;
        let children = elTeam.Children();
        for (let i = 0; i < children.length; i++) {
            if (oPlayer.m_xuid === children[i].m_xuid)
                continue;
            let oCompareTargetPlayer = _m_oPlayers.GetPlayerByXuid(children[i].m_xuid);
            if (!oCompareTargetPlayer)
                continue;
            for (let stat in _m_sortOrder) {
                let p1stat = oPlayer.m_oStats[stat];
                let p2stat = oCompareTargetPlayer.m_oStats[stat];
                if (_m_sortOrder[stat] === -1) {
                    let tmp = p1stat;
                    p1stat = p2stat;
                    p2stat = tmp;
                }
                if (_lessthan(p2stat, p1stat)) {
                    if (children[i - 1] != elPlayer) {
                        elTeam.MoveChildBefore(elPlayer, children[i]);
                    }
                    return;
                }
                else if (_lessthan(p1stat, p2stat)) {
                    break;
                }
            }
        }
    }
    function IsTeamASpecTeam(teamname) {
        return (teamname === 'Spectator' ||
            teamname === 'Unassigned' ||
            teamname === 'Unknown' ||
            teamname === 'UNKNOWN TEAM' ||
            teamname === '');
    }
    function _UpdateAllStatsForPlayer(idx, bSilent = false) {
        let oPlayer = _m_oPlayers.GetPlayerByIndex(idx);
        for (let stat in _m_oUpdateStatFns) {
            if (typeof (_m_oUpdateStatFns[stat]) === 'function') {
                _m_oUpdateStatFns[stat](oPlayer, bSilent);
            }
        }
    }
    function _GenericUpdateStat(oPlayer, stat, fnGetStat, bSilent = false) {
        let elPanel = oPlayer.m_oElStats[stat];
        if (!elPanel || !elPanel.IsValid())
            return;
        let elLabel = elPanel.FindChildTraverse('label');
        let newStatValue = fnGetStat(oPlayer.m_xuid);
        if (newStatValue !== oPlayer.m_oStats[stat]) {
            if (!bSilent) {
                if (elLabel && elLabel.IsValid()) {
                    _Pulse(elLabel);
                }
            }
            oPlayer.m_oStats[stat] = newStatValue;
            if (elLabel && elLabel.IsValid()) {
                elLabel.text = newStatValue.toString();
            }
        }
    }
    function _GetMatchStatFn(stat) {
        function _fn(xuid) {
            let oPlayer = _m_oPlayers.GetPlayerByXuid(xuid);
            let allstats = oPlayer.m_oMatchStats;
            if (allstats)
                return (allstats[stat] == -1) ? '-' : allstats[stat];
            return '-';
        }
        return _fn;
    }
    function _CreateStatUpdateFn(stat) {
        let fn;
        switch (stat) {
            case 'musickit':
                fn = oPlayer => {
                    if (MockAdapter.IsFakePlayer(oPlayer.m_xuid))
                        return;
                    let ownerXuid = oPlayer.m_xuid;
                    let isLocalPlayer = oPlayer.m_xuid == GetLocalPlayerId();
                    let isBorrowed = false;
                    let borrowedXuid = "0";
                    let borrowedPlayerSlot = parseInt(GameInterfaceAPI.GetSettingString('cl_borrow_music_from_player_slot'));
                    if (borrowedPlayerSlot >= 0 && isLocalPlayer) {
                        borrowedXuid = GameStateAPI.GetPlayerXuidStringFromPlayerSlot(borrowedPlayerSlot);
                        if (MockAdapter.IsPlayerConnected(borrowedXuid)) {
                            ownerXuid = borrowedXuid;
                            isBorrowed = true;
                        }
                    }
                    let newStatValue = InventoryAPI.GetMusicIDForPlayer(ownerXuid);
                    if (newStatValue !== oPlayer.m_oStats[stat]) {
                        oPlayer.m_oStats[stat] = newStatValue;
                        if (isLocalPlayer) {
                            let elMusicKit = $('#id-sb-meta__musickit');
                            if (!elMusicKit || !elMusicKit.IsValid())
                                return;
                            let isValidMusicKit = newStatValue > 0;
                            elMusicKit.SetHasClass('hidden', !isValidMusicKit);
                            if (isValidMusicKit) {
                                _m_cP.FindChildTraverse('id-sb-meta__musickit-unborrow').SetHasClass('hidden', !isBorrowed);
                                let imagepath = 'file://{images}/' + InventoryAPI.GetItemInventoryImageFromMusicID(newStatValue) + '.png';
                                $('#id-sb-meta__musickit-image').SetImage(imagepath);
                                $('#id-sb-meta__musickit-name').text = $.Localize(InventoryAPI.GetMusicNameFromMusicID(newStatValue));
                            }
                        }
                    }
                    let elPlayer = oPlayer.m_elPlayer;
                    if (elPlayer && elPlayer.IsValid()) {
                        let elMusicKitIcon = elPlayer.FindChildTraverse('id-sb-name__musickit');
                        if (elMusicKitIcon && elMusicKitIcon.IsValid()) {
                            elMusicKitIcon.SetHasClass('hidden', newStatValue <= 1);
                        }
                    }
                };
                break;
            case 'teamname':
                fn = oPlayer => {
                    let newStatValue = MockAdapter.GetPlayerTeamName(oPlayer.m_xuid);
                    _ChangeTeams(oPlayer, newStatValue);
                };
                break;
            case 'ping':
                fn = oPlayer => {
                    let elPlayer = oPlayer.m_elPlayer;
                    if (!elPlayer || !elPlayer.IsValid())
                        return;
                    let elPanel = oPlayer.m_oElStats[stat];
                    if (!elPanel || !elPanel.IsValid())
                        return;
                    let elLabel = elPanel.FindChildTraverse('label');
                    if (!elLabel)
                        return;
                    oPlayer.m_elPlayer?.SetHasClass('bot', MockAdapter.IsFakePlayer(oPlayer.m_xuid));
                    let szCustomLabel = _GetCustomStatTextValue('ping', oPlayer.m_xuid);
                    elLabel.SetHasClass('sb-row__cell--ping__label--bot', !!szCustomLabel);
                    if (szCustomLabel) {
                        elLabel.text = $.Localize(szCustomLabel);
                        oPlayer.m_oStats[stat] = szCustomLabel;
                    }
                    else {
                        _GenericUpdateStat(oPlayer, stat, MockAdapter.GetPlayerPing, true);
                    }
                };
                break;
            case 'kills':
                fn = (oPlayer, bSilent = false) => {
                    _GenericUpdateStat(oPlayer, stat, MockAdapter.GetPlayerKills, bSilent);
                };
                break;
            case 'assists':
                fn = (oPlayer, bSilent = false) => {
                    _GenericUpdateStat(oPlayer, stat, MockAdapter.GetPlayerAssists, bSilent);
                };
                break;
            case 'deaths':
                fn = (oPlayer, bSilent = false) => {
                    _GenericUpdateStat(oPlayer, stat, MockAdapter.GetPlayerDeaths, bSilent);
                };
                break;
            case '3k':
            case '4k':
            case '5k':
            case 'adr':
            case 'hsp':
            case 'utilitydamage':
            case 'enemiesflashed':
            case 'damage':
            case 'knifekills':
            case 'taserkills':
                fn = (oPlayer, bSilent = false) => {
                    _GenericUpdateStat(oPlayer, stat, _GetMatchStatFn(stat), bSilent);
                };
                break;
            case 'kdr':
                fn = (oPlayer, bSilent = false) => {
                    let kdr;
                    if (_m_overtime == 0) {
                        let kdrFn = _GetMatchStatFn('kdr');
                        kdr = kdrFn(oPlayer.m_xuid);
                        if (typeof kdr == 'number' && kdr > 0) {
                            kdr = kdr / 100.0;
                        }
                    }
                    else {
                        let denom = oPlayer.GetStatNum('deaths') || 1;
                        kdr = oPlayer.GetStatNum('kills') / denom;
                    }
                    if (typeof kdr == 'number') {
                        kdr = kdr.toFixed(2);
                    }
                    _GenericUpdateStat(oPlayer, stat, () => { return kdr; }, bSilent);
                };
                break;
            case 'mvps':
                fn = (oPlayer, bSilent = false) => {
                    let newStatValue = MockAdapter.GetPlayerMVPs(oPlayer.m_xuid);
                    if (newStatValue !== oPlayer.m_oStats[stat]) {
                        let elMVPPanel = oPlayer.m_oElStats[stat];
                        if (!elMVPPanel || !elMVPPanel.IsValid())
                            return;
                        let elMVPStarImage = elMVPPanel.FindChildTraverse('star-image');
                        if (!elMVPStarImage || !elMVPStarImage.IsValid())
                            return;
                        let elMVPStarNumberLabel = elMVPPanel.FindChildTraverse('star-count');
                        if (!elMVPStarNumberLabel || !elMVPStarNumberLabel.IsValid())
                            return;
                        oPlayer.m_oStats[stat] = newStatValue;
                        elMVPStarImage.SetHasClass('hidden', newStatValue == 0);
                        elMVPStarNumberLabel.SetHasClass('hidden', newStatValue == 0);
                        elMVPStarNumberLabel.text = newStatValue.toString();
                        if (!bSilent) {
                            _Pulse(elMVPStarImage);
                            _Pulse(elMVPStarNumberLabel);
                        }
                    }
                };
                break;
            case 'status':
                fn = oPlayer => {
                    let newStatValue = MockAdapter.GetPlayerStatus(oPlayer.m_xuid);
                    if (newStatValue !== oPlayer.m_oStats[stat]) {
                        oPlayer.m_oStats[stat] = newStatValue;
                        let elPlayer = oPlayer.m_elPlayer;
                        if (!elPlayer || !elPlayer.IsValid())
                            return;
                        elPlayer.SetHasClass('sb-player-status-dead', newStatValue === 1);
                        elPlayer.SetHasClass('sb-player-status-disconnected', newStatValue === 15);
                        oPlayer.m_oStats['dc'] = newStatValue === 15 ? 0 : 1;
                        let elPanel = oPlayer.m_oElStats[stat];
                        if (!elPanel || !elPanel.IsValid())
                            return;
                        let elStatusImage = elPanel.FindChildTraverse('image');
                        if (!elStatusImage || !elStatusImage.IsValid())
                            return;
                        elStatusImage.SetImage(dictPlayerStatusImage[newStatValue]);
                    }
                };
                break;
            case 'score':
                fn = oPlayer => {
                    _GenericUpdateStat(oPlayer, stat, MockAdapter.GetPlayerScore);
                };
                break;
            case 'gglevel':
                fn = oPlayer => {
                    _GenericUpdateStat(oPlayer, stat, () => Math.floor(MockAdapter.GetPlayerScore(oPlayer.m_xuid) / 2));
                };
                break;
            case 'money':
                fn = oPlayer => {
                    let elPanel = oPlayer.m_oElStats[stat];
                    if (!elPanel || !elPanel.IsValid())
                        return;
                    let elLabel = elPanel.FindChildTraverse('label');
                    if (!elLabel || !elLabel.IsValid())
                        return;
                    let newStatValue = MockAdapter.GetPlayerMoney(oPlayer.m_xuid);
                    if (newStatValue !== oPlayer.m_oStats[stat]) {
                        if (newStatValue >= 0) {
                            elLabel.SetHasClass('hidden', false);
                            elLabel.SetDialogVariableInt('stat_d_money', newStatValue);
                        }
                        else {
                            elLabel.SetHasClass('hidden', true);
                        }
                    }
                    oPlayer.m_oStats[stat] = newStatValue;
                };
                break;
            case 'name':
                fn = oPlayer => {
                    if (!oPlayer.m_elPlayer || !oPlayer.m_elPlayer.IsValid())
                        return;
                    oPlayer.m_elPlayer.SetHasClass('sb-row--localplayer', oPlayer.m_xuid === GetLocalPlayerId());
                    let elPanel = oPlayer.m_oElStats[stat];
                    if (!elPanel || !elPanel.IsValid())
                        return;
                    oPlayer.m_elPlayer.SetDialogVariableInt('player_slot', GameStateAPI.GetPlayerSlot(oPlayer.m_xuid));
                };
                break;
            case 'honoricon':
                fn = oPlayer => {
                    if (!oPlayer.m_elPlayer || !oPlayer.m_elPlayer.IsValid())
                        return;
                    const xp_trail_level = GameStateAPI.GetPlayerXpTrailLevel(oPlayer.m_xuid);
                    if (oPlayer.m_xp_trail_level != xp_trail_level) {
                        const honorIconOptions = {
                            honor_icon_frame_panel: oPlayer.m_elPlayer.FindChildTraverse('jsHonorIcon'),
                            debug_xuid: oPlayer.m_xuid,
                            do_fx: true,
                            xptrail_value: GameStateAPI.GetPlayerXpTrailLevel(oPlayer.m_xuid)
                        };
                        HonorIcon.SetOptions(honorIconOptions);
                        oPlayer.m_xp_trail_level = xp_trail_level;
                    }
                };
                break;
            case 'leader':
            case 'teacher':
            case 'friendly':
                fn = oPlayer => {
                    let newStatValue;
                    if (GameStateAPI.IsDemoOrHltv() || IsTeamASpecTeam(GameStateAPI.GetPlayerTeamName(GetLocalPlayerId())))
                        return;
                    if (!GameStateAPI.IsXuidValid(oPlayer.m_xuid)) {
                        return;
                    }
                    else {
                        switch (stat) {
                            case 'leader':
                                newStatValue = GameStateAPI.GetPlayerCommendsLeader(oPlayer.m_xuid);
                                break;
                            case 'teacher':
                                newStatValue = GameStateAPI.GetPlayerCommendsTeacher(oPlayer.m_xuid);
                                break;
                            case 'friendly':
                                newStatValue = GameStateAPI.GetPlayerCommendsFriendly(oPlayer.m_xuid);
                                break;
                        }
                    }
                    if (oPlayer.m_oStats[stat] != newStatValue) {
                        oPlayer.m_oStats[stat] = newStatValue;
                        let oTeam = _m_oTeams[oPlayer.GetStatText('teamname')];
                        if (oTeam)
                            oTeam.UpdateCommendForPlayer(oPlayer.m_xuid, stat, newStatValue);
                    }
                };
                break;
            case 'flair':
                fn = oPlayer => {
                    if (GameStateAPI.IsLatched())
                        return;
                    let newStatValue = InventoryAPI.GetFlairItemId(oPlayer.m_xuid);
                    if (oPlayer.m_oStats[stat] !== newStatValue) {
                        oPlayer.m_oStats[stat] = newStatValue;
                        let elPanel = oPlayer.m_oElStats[stat];
                        if (!elPanel || !elPanel.IsValid())
                            return;
                        let elFlairImage = elPanel.FindChildTraverse('image');
                        if (!elFlairImage || !elFlairImage.IsValid())
                            return;
                        let imagepath = InventoryAPI.GetFlairItemImage(oPlayer.m_xuid);
                        if (imagepath !== '') {
                            elFlairImage.SetImage('file://{images}' + imagepath + '_small.png');
                        }
                    }
                };
                break;
            case 'avatar':
                fn = oPlayer => {
                    let elPanel = oPlayer.m_oElStats[stat];
                    if (!elPanel || !elPanel.IsValid())
                        return;
                    let elAvatarImage = elPanel.FindChildTraverse('image');
                    if (!elAvatarImage || !elAvatarImage.IsValid())
                        return;
                    elAvatarImage.PopulateFromPlayerSlot(GameStateAPI.GetPlayerSlot(oPlayer.m_xuid));
                    let team = GameStateAPI.GetPlayerTeamName(oPlayer.m_xuid);
                    elAvatarImage.SwitchClass('teamstyle', 'team--' + team);
                    let elPlayerColor = elAvatarImage.FindChildTraverse('player-color');
                    if (elPlayerColor && elPlayerColor.IsValid()) {
                        let teamColor = GameStateAPI.GetPlayerColor(oPlayer.m_xuid);
                        if (teamColor !== '') {
                            elPlayerColor.style.washColor = teamColor;
                            elPlayerColor.RemoveClass('hidden');
                        }
                        else {
                            elPlayerColor.AddClass('hidden');
                        }
                    }
                    let isMuted = GameStateAPI.IsSelectedPlayerMuted(oPlayer.m_xuid);
                    oPlayer.m_isMuted = isMuted;
                    let isEnemyTeamMuted = GameInterfaceAPI.GetSettingString("cl_mute_enemy_team") == "1";
                    let isEnemy = GameStateAPI.ArePlayersEnemies(oPlayer.m_xuid, GetLocalPlayerId());
                    let hasComAbusePenalty = GameStateAPI.HasCommunicationAbuseMute(oPlayer.m_xuid);
                    let isLocalPlayer = oPlayer.m_xuid == GetLocalPlayerId();
                    oPlayer.m_elPlayer.SetHasClass('muted', isMuted || (isEnemy && isEnemyTeamMuted) || (isLocalPlayer && hasComAbusePenalty));
                };
                break;
            case 'skillgroup':
                fn = oPlayer => {
                    const elPlayer = oPlayer.m_elPlayer;
                    if (!elPlayer || !elPlayer.IsValid())
                        return;
                    let newStatValue = MockAdapter.GetPlayerCompetitiveRanking(oPlayer.m_xuid);
                    let elSkillgroup = elPlayer.FindChildTraverse('jsRatingEmblem');
                    if (elSkillgroup && elSkillgroup.IsValid()) {
                        if (newStatValue > 0) {
                            elSkillgroup.visible = true;
                            if (oPlayer.m_oStats[stat] !== newStatValue) {
                                oPlayer.m_oStats[stat] = newStatValue;
                                const rating_type = MockAdapter.GetPlayerCompetitiveRankType(oPlayer.m_xuid);
                                const score = MockAdapter.GetPlayerCompetitiveRanking(oPlayer.m_xuid);
                                const wins = MockAdapter.GetPlayerCompetitiveWins(oPlayer.m_xuid);
                                let options = {
                                    root_panel: elPlayer.FindChildTraverse('jsRatingEmblem'),
                                    full_details: false,
                                    rating_type: rating_type,
                                    leaderboard_details: { score: score, matchesWon: wins },
                                    local_player: oPlayer.m_xuid === MyPersonaAPI.GetXuid()
                                };
                                RatingEmblem.SetXuid(options);
                            }
                        }
                        else {
                            elSkillgroup.visible = false;
                        }
                    }
                    ;
                };
                break;
            case 'rank':
                fn = oPlayer => {
                    let newStatValue = MockAdapter.GetPlayerXpLevel(oPlayer.m_xuid);
                    if (oPlayer.m_oStats[stat] !== newStatValue) {
                        oPlayer.m_oStats[stat] = newStatValue;
                        let elPanel = oPlayer.m_oElStats[stat];
                        if (!elPanel || !elPanel.IsValid())
                            return;
                        let elRankImage = elPanel.FindChildTraverse('image');
                        if (!elRankImage || !elRankImage.IsValid())
                            return;
                        let imagepath = '';
                        if (newStatValue > 0) {
                            imagepath = 'file://{images}/icons/xp/level' + newStatValue + '.png';
                        }
                        else {
                            imagepath = '';
                        }
                        elRankImage.SetImage(imagepath);
                    }
                };
                break;
            default:
                return;
        }
        _m_oUpdateStatFns[stat] = fn;
    }
    function _GetPlayerRowForGameMode() {
        let mode = MockAdapter.GetGameModeInternalName(false);
        let skirmish = MockAdapter.GetGameModeInternalName(true);
        if (GameStateAPI.IsQueuedMatchmakingMode_Team()) {
            return 'snippet_scoreboard-classic__row--premier';
        }
        switch (mode) {
            case 'scrimcomp2v2':
                return 'snippet_scoreboard-classic__row--wingman';
            case 'competitive':
            case 'premier':
                return 'snippet_scoreboard-classic__row--comp';
            case 'training':
                return 'snippet_scoreboard__row--training';
            case 'deathmatch':
                return 'snippet_scoreboard__row--deathmatch';
            case 'gungameprogressive':
                return 'snippet_scoreboard__row--armsrace';
            case 'coopmission':
            case 'cooperative':
                return 'snippet_scoreboard__row--cooperative';
            case 'casual':
                if (skirmish == 'flyingscoutsman')
                    return 'snippet_scoreboard__row--flyingscoutsman';
                else
                    return 'snippet_scoreboard-classic__row--casual';
            default:
                return 'snippet_scoreboard-classic__row--casual';
        }
    }
    function _HighlightSortStatLabel(stat) {
        for (let el of _m_cP.FindChildrenWithClassTraverse('sb-row__cell')) {
            if (el && el.IsValid()) {
                if (el.BHasClass('sb-row__cell--' + stat)) {
                    el.AddClass('sortstat');
                }
                else {
                    el.RemoveClass('sortstat');
                }
            }
        }
    }
    function _CreateLabelForStat(stat, set, isHidden) {
        let elLabelRow = $('#id-sb-players-table__labels-row__inner');
        if (!elLabelRow || !elLabelRow.IsValid())
            return;
        let elLabelRowOrSet = elLabelRow;
        if (set !== '') {
            let labelSetContainerId = 'id-sb-row__set-container';
            let elLabelSetContainer = $('#' + labelSetContainerId);
            if (!elLabelSetContainer || !elLabelSetContainer.IsValid()) {
                elLabelSetContainer = $.CreatePanel('Panel', elLabelRow, labelSetContainerId);
                elLabelSetContainer.BLoadLayoutSnippet('snippet_sb-label-set-container');
                if ($('#id-sb-row__set-container')) {
                    $('#id-sb-meta__cycle').RemoveClass('hidden');
                }
            }
            let elSetLabels = elLabelSetContainer.FindChildTraverse('id-sb-row__sets');
            let LabelSetId = 'id-sb-labels-set-' + set;
            let elLabelSet = elSetLabels.FindChildTraverse(LabelSetId);
            if (!elLabelSet || !elLabelSet.IsValid()) {
                _m_dataSetGetCount++;
                elLabelSet = $.CreatePanel('Panel', elSetLabels, LabelSetId);
                elLabelSet.AddClass('sb-row__set');
                elLabelSet.AddClass('no-hover');
            }
            elLabelRowOrSet = elLabelSet;
            if (set != _m_dataSetCurrent.toString()) {
                elLabelSet.AddClass('hidden');
            }
        }
        let elStatPanel = elLabelRowOrSet.FindChildInLayoutFile('id-sb-' + stat);
        if (!elStatPanel || !elStatPanel.IsValid()) {
            elStatPanel = $.CreatePanel('Button', elLabelRowOrSet, 'id-sb-' + stat);
            elStatPanel.AddClass('sb-row__cell');
            elStatPanel.AddClass('sb-row__cell--' + stat);
            elStatPanel.AddClass('sb-row__cell--label');
            let elStatLabel;
            if (stat === 'ping') {
                elStatLabel = $.CreatePanel('Image', elStatPanel, 'label-' + elStatPanel.id);
                elStatLabel.SetImage('file://{images}/icons/ui/ping_4.svg');
            }
            else {
                elStatLabel = $.CreatePanel('Label', elStatPanel, 'label-' + elStatPanel.id);
                if (isHidden == '1') {
                    elStatLabel.text = '';
                }
                else {
                    elStatLabel.text = $.Localize('#Scoreboard_' + stat);
                }
            }
            let toolTipString = $.Localize('#Scoreboard_' + stat + '_tooltip');
            if (toolTipString !== '') {
                elStatLabel.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip(elStatLabel.id, toolTipString));
                elStatLabel.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
            }
            elStatPanel.SetPanelEvent('onactivate', () => {
                let newSortOrder = { 'dc': 0 };
                let modeDefaultSortOrder = _GetSortOrderForMode(MockAdapter.GetGameModeInternalName(false));
                if (stat in modeDefaultSortOrder)
                    newSortOrder[stat] = modeDefaultSortOrder[stat];
                else
                    return;
                _HighlightSortStatLabel(stat);
                for (let s in modeDefaultSortOrder) {
                    if (s == stat)
                        continue;
                    if (s == 'dc')
                        continue;
                    newSortOrder[s] = modeDefaultSortOrder[s];
                }
                _m_sortOrder = newSortOrder;
                for (let i = 0; i < _m_oPlayers.GetCount(); i++) {
                    _SortPlayer(i);
                }
            });
        }
    }
    function _GetCustomStatTextValue(stat, xuid) {
        let szCustomLabel = null;
        if (stat === 'ping') {
            if (MockAdapter.GetPlayerStatus(xuid) == 15) {
                szCustomLabel = '#SFUI_scoreboard_lbl_dc';
            }
            else if (IsTeamASpecTeam(MockAdapter.GetPlayerTeamName(xuid))) {
                szCustomLabel = '#SFUI_scoreboard_lbl_spec';
            }
        }
        return szCustomLabel;
    }
    function _CreatePlayerButtons(oPlayer) {
        if (MockAdapter.IsFakePlayer(oPlayer.m_xuid))
            return;
        const xuid = oPlayer.m_elPlayer ? oPlayer.m_elPlayer.m_xuid : '';
        for (let entry of ContextmenuPlayerCard.ContextMenus) {
            if (entry.AvailableForItem(xuid)) {
                if (!oPlayer.m_oElStats.hasOwnProperty(entry.name))
                    continue;
                const elContextMenuBtns = oPlayer.m_oElStats[entry.name];
                if ('xml' in entry) {
                    let elEntryBtn = $.CreatePanel('Panel', elContextMenuBtns, entry.name, {
                        class: 'cell__button',
                        style: 'tooltip-position: bottom;'
                    });
                    elEntryBtn.BLoadLayout(entry.xml, false, false);
                }
                else {
                    let elEntryBtn = $.CreatePanel('Button', elContextMenuBtns, entry.name + '_' + xuid, {
                        class: 'cell__button',
                        style: 'tooltip-position: bottom;'
                    });
                    $.CreatePanel('Image', elEntryBtn, entry.name, { src: 'file://{images}/icons/ui/' + entry.icon + '.svg' });
                    let tooltip = '#tooltip_' + entry.name;
                    if ('IsDisabled' in entry) {
                        if (entry.IsDisabled()) {
                            elEntryBtn.enabled = false;
                            tooltip = '#tooltip_disabled_' + entry.name;
                        }
                        else {
                            elEntryBtn.enabled = true;
                        }
                    }
                    let onSelected = entry.OnSelected;
                    elEntryBtn.SetPanelEvent('onactivate', () => onSelected(xuid, ''));
                    {
                        elEntryBtn.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip(elEntryBtn.id, tooltip));
                        elEntryBtn.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
                    }
                }
            }
        }
    }
    function _NewPlayerPanel(oPlayer) {
        if (!oPlayer.m_elTeam || !oPlayer.m_elTeam.IsValid())
            return;
        oPlayer.m_elPlayer = $.CreatePanel('Panel', oPlayer.m_elTeam, 'player-' + oPlayer.m_xuid);
        oPlayer.m_elPlayer.m_xuid = oPlayer.m_xuid;
        _Helper_LoadSnippet(oPlayer.m_elPlayer, _GetPlayerRowForGameMode());
        let idx = 0;
        function _InitStatCell(elStatCell, oPlayer) {
            if (!elStatCell || !elStatCell.IsValid())
                return;
            const stat = elStatCell.GetAttributeString('data-stat', '');
            let children = elStatCell.Children();
            for (let i = 0; i < children.length; i++) {
                _InitStatCell(children[i], oPlayer);
            }
            if (stat === '') {
                return;
            }
            oPlayer.m_oElStats[stat] = elStatCell;
            elStatCell.AddClass('sb-row__cell');
            elStatCell.AddClass('sb-row__cell--' + stat);
            const set = elStatCell.GetAttributeString('data-set', '');
            if (set !== '') {
                let SetContainerId = 'id-sb-row__set-container';
                let elParent = elStatCell.GetParent();
                let elSetContainer = oPlayer.m_elPlayer.FindChildTraverse(SetContainerId);
                if (!elSetContainer || !elSetContainer.IsValid()) {
                    elSetContainer = $.CreatePanel('Panel', elParent, SetContainerId);
                    elParent.MoveChildAfter(elSetContainer, elStatCell);
                }
                let setId = 'id-sb-set-' + set;
                let elSet = elSetContainer.FindChildTraverse(setId);
                if (!elSet || !elSet.IsValid) {
                    elSet = $.CreatePanel('Panel', elSetContainer, setId);
                    elSet.AddClass('sb-row__set');
                    elSet.AddClass('no-hover');
                    idx = 0;
                }
                elStatCell.SetParent(elSet);
                if (set != _m_dataSetCurrent.toString()) {
                    elSet.AddClass('hidden');
                }
            }
            if (idx++ % 2)
                elStatCell.AddClass('sb-row__cell--dark');
            const isHidden = elStatCell.GetAttributeString('data-hidden', '');
            if (!isHidden) {
                _CreateStatUpdateFn(stat);
            }
        }
        _CreateStatUpdateFn('teamname');
        _CreateStatUpdateFn('musickit');
        _CreateStatUpdateFn('status');
        _CreateStatUpdateFn('skillgroup');
        _CreateStatUpdateFn('leader');
        _CreateStatUpdateFn('teacher');
        _CreateStatUpdateFn('friendly');
        _CreateStatUpdateFn('honoricon');
        const elStatCells = oPlayer.m_elPlayer.Children();
        for (let i = 0; i < elStatCells.length; i++) {
            _InitStatCell(elStatCells[i], oPlayer);
        }
        _CreatePlayerButtons(oPlayer);
        oPlayer.m_oStats = {};
        oPlayer.m_oStats['idx'] = GameStateAPI.GetPlayerSlot(oPlayer.m_xuid);
        oPlayer.m_elPlayer.SetPanelEvent('onmouseover', () => { _m_arrSortingPausedRefGetCounter++; });
        oPlayer.m_elPlayer.SetPanelEvent('onmouseout', () => { _m_arrSortingPausedRefGetCounter--; });
        if (MockAdapter.IsXuidValid(oPlayer.m_xuid)) {
            oPlayer.m_elPlayer.SetPanelEvent('onactivate', () => {
                _m_arrSortingPausedRefGetCounter++;
                let elPlayerCardContextMenu = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEventSetFocus('', '', 'file://{resources}/layout/context_menus/context_menu_playercard.xml', 'xuid=' + oPlayer.m_xuid, _OnPlayerCardDismiss, false);
                elPlayerCardContextMenu.AddClass('ContextMenu_NoArrow');
                if (!_m_hDenyInputToGame) {
                    _m_hDenyInputToGame = UiToolkitAPI.AddDenyInputFlagsToGame(elPlayerCardContextMenu, 'ScoreboardPlayercard', 'CaptureMouse');
                }
            });
        }
        return oPlayer.m_elPlayer;
    }
    function _OnPlayerCardDismiss() {
        _m_arrSortingPausedRefGetCounter--;
        if (_m_hDenyInputToGame) {
            UiToolkitAPI.ReleaseDenyInputFlagsToGame(_m_hDenyInputToGame);
            _m_hDenyInputToGame = null;
        }
    }
    function _UpdateMatchInfo() {
        if (!_m_bInit)
            return;
        _m_cP.SetDialogVariable('server_name', _m_haveViewers ? '' : MockAdapter.GetServerName());
        _m_cP.SetDialogVariable('map_name', MockAdapter.GetMapName());
        _m_cP.SetDialogVariable('gamemode_name', MockAdapter.GetGameModeName(true));
        _m_cP.SetDialogVariable('tournament_stage', MockAdapter.GetTournamentEventStage());
        const elMapLabel = _m_cP.FindChildTraverse('id-sb-meta__labels__mode-map');
        if (elMapLabel && elMapLabel.IsValid() && elMapLabel.text == '') {
            if (MatchStatsAPI.IsTournamentMatch()) {
                elMapLabel.text = $.Localize('{s:tournament_stage} | {s:map_name}', _m_cP);
            }
            else {
                let strLocalizeScoreboardTitle = '{s:gamemode_name} | {s:map_name}';
                let mode = GameStateAPI.GetGameModeInternalName(true);
                if ((mode === 'competitive' || mode === 'premier') &&
                    (GameTypesAPI.GetMapGroupAttribute('mg_' + GameStateAPI.GetMapBSPName(), 'competitivemod') === 'unranked')) {
                    strLocalizeScoreboardTitle = $.Localize('#SFUI_RankType_Modifier_Unranked', _m_cP) + ' | {s:map_name}';
                }
                else if (GameStateAPI.IsQueuedMatchmakingMode_Team()) {
                    let sMapName = '{s:map_name}';
                    if (GameStateAPI.GetMapBSPName() === 'lobby_mapveto')
                        sMapName = $.Localize('#matchdraft_arena_name', _m_cP);
                    strLocalizeScoreboardTitle = $.Localize('#SFUI_GameModeCompetitiveTeams', _m_cP) + ' | ' + sMapName;
                }
                elMapLabel.text = $.Localize(strLocalizeScoreboardTitle, _m_cP);
            }
        }
        if ($('#id-sb-meta__mode__image')) {
            if (GameStateAPI.IsQueuedMatchmakingMode_Team())
                $('#id-sb-meta__mode__image').SetImage('file://{images}/icons/ui/competitive_teams.svg');
            else
                $('#id-sb-meta__mode__image').SetImage(MockAdapter.GetGameModeImagePath());
        }
        if ($('#sb-meta__labels__map'))
            $('#sb-meta__labels__map').SetImage('file://{images}/map_icons/map_icon_' + MockAdapter.GetMapBSPName() + '.svg');
        let elCoopStats = $('#CoopStats');
        if (elCoopStats) {
            let questID = GameStateAPI.GetActiveQuestID();
            if (questID > 0) {
                elCoopStats.AddClass('show-mission-desc');
                let elLabel = elCoopStats.FindChildInLayoutFile('MissionDescriptionLabel');
                if (elLabel) {
                    let strMissionDescriptionToken = MissionsAPI.GetQuestDefinitionField(questID, 'loc_description');
                    elLabel.text = $.Localize(strMissionDescriptionToken, elCoopStats);
                }
            }
        }
        if (!MockAdapter.IsDemoOrHltv()) {
            const localTeamName = MockAdapter.GetPlayerTeamName(GetLocalPlayerId());
            if (_m_oTeams[localTeamName])
                _m_oTeams[localTeamName].CalculateAllCommends();
        }
        const elMouseBinding = _m_cP.FindChildInLayoutFile('id-sb-mouse-instructions');
        if (elMouseBinding && elMouseBinding.IsValid()) {
            let bind = GameInterfaceAPI.GetSettingString('cl_scoreboard_mouse_enable_binding');
            if (bind.charAt(0) == '+' || bind.charAt(0) == '-')
                bind = bind.substring(1);
            elMouseBinding.SetDialogVariable('scoreboard_mouse_enable_bind', $.Localize(`{s:bind_${bind}}`, elMouseBinding));
            elMouseBinding.text = $.Localize('#Scoreboard_Mouse_Enable_Instruction', elMouseBinding);
        }
        const elFooterWebsite = _m_cP.FindChildInLayoutFile('id-sb-footer-server-website');
        if (elFooterWebsite && elFooterWebsite.IsValid()) {
            const strWebsiteURL = MatchStatsAPI.GetServerWebsiteURL(false);
            if (strWebsiteURL) {
                elFooterWebsite.SetHasClass('hidden', false);
                elFooterWebsite.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip('id-sb-footer-server-website', strWebsiteURL));
                elFooterWebsite.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
            }
            else {
                elFooterWebsite.SetHasClass('hidden', true);
            }
        }
    }
    function _UpdateHLTVViewerNumber(nViewers) {
        _m_cP.SetDialogVariableInt('viewers', nViewers);
        _m_haveViewers = nViewers > 0;
        _m_cP.SetDialogVariable('hltv_viewers', _m_haveViewers ? $.Localize('#Scoreboard_Viewers', _m_cP) : '');
    }
    function _UpdateRound(rnd, oScoreData, jsoTime) {
        if (!_SupportsTimeline(jsoTime))
            return;
        if (!oScoreData)
            return;
        if (!jsoTime)
            return;
        if (!('teamdata' in oScoreData))
            return;
        let elTimeline = _m_cP.FindChildInLayoutFile('id-sb-timeline__segments');
        if (!elTimeline || !elTimeline.IsValid())
            return;
        let elRnd = elTimeline.FindChildTraverse(rnd.toString());
        if (!elRnd || !elRnd.IsValid())
            return;
        let elRndTop = elRnd.FindChildTraverse('id-sb-timeline__segment__round--top');
        let elRndBot = elRnd.FindChildTraverse('id-sb-timeline__segment__round--bot');
        elRndTop.FindChildTraverse('result').SetImage('');
        elRndBot.FindChildTraverse('result').SetImage('');
        elRndTop.SetDialogVariable('sb_clinch', '');
        elRndBot.SetDialogVariable('sb_clinch', '');
        let elTick = elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick');
        if (elTick && elTick.IsValid()) {
            elTick.SetHasClass('hilite', rnd <= jsoTime['rounds_played'] + 1);
        }
        if (rnd > jsoTime['rounds_played']) {
            let bCanClinch = jsoTime['can_clinch'];
            if (bCanClinch) {
                let numToClinch = jsoTime['num_wins_to_clinch'];
                let topClinchRound = jsoTime['rounds_played'] + numToClinch - m_topScore;
                let bThisRoundIsClinchTop = rnd == topClinchRound;
                let botClinchRound = jsoTime['rounds_played'] + numToClinch - m_botScore;
                let bThisRoundIsClinchBot = rnd == botClinchRound;
                let bShowClinchTop = (bThisRoundIsClinchTop && topClinchRound <= botClinchRound);
                let bShowClinchBot = (bThisRoundIsClinchBot && botClinchRound <= topClinchRound);
                let thisRoundIsClinchAndShowIt = false;
                if (bShowClinchTop) {
                    elRndTop.FindChildTraverse('result').SetImage(dictRoundResultImage['win']);
                    thisRoundIsClinchAndShowIt = true;
                }
                if (bShowClinchBot) {
                    elRndBot.FindChildTraverse('result').SetImage(dictRoundResultImage['win']);
                    thisRoundIsClinchAndShowIt = true;
                }
                let roundIsPastClinch = (rnd > topClinchRound || rnd > botClinchRound);
                elRnd.SetHasClass('past-clinch', roundIsPastClinch);
                elRnd.SetHasClass('clinch-round', thisRoundIsClinchAndShowIt);
            }
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick').RemoveClass('sb-team--CT');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick__label').RemoveClass('sb-team--CT');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick').RemoveClass('sb-team--TERRORIST');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick__label').RemoveClass('sb-team--TERRORIST');
            function _ClearCasualties(elRnd) {
                for (let i = 1; i <= 5; i++) {
                    let img = elRnd.FindChildTraverse('casualty-' + i);
                    if (!img)
                        break;
                    img.AddClass('hidden');
                }
            }
            ;
            _ClearCasualties(elRndTop);
            _ClearCasualties(elRndBot);
            return;
        }
        let bFlippedSides = false;
        if (MockAdapter.AreTeamsPlayingSwitchedSides() !== MockAdapter.AreTeamsPlayingSwitchedSidesInRound(rnd)) {
            bFlippedSides = true;
            let elTemp = elRndTop;
            elRndTop = elRndBot;
            elRndBot = elTemp;
        }
        elRndTop.AddClass('sb-team--CT');
        elRndBot.AddClass('sb-team--TERRORIST');
        const roundData = oScoreData.rounddata[rnd];
        if (typeof roundData !== 'object')
            return;
        let result = roundData['result'].replace(/^(ct_|t_)/, '');
        if (roundData['result'].charAt(0) === 'c') {
            if (bFlippedSides)
                m_botScore++;
            else
                m_topScore++;
            elRndTop.FindChildTraverse('result').SetImage(dictRoundResultImage[result]);
            elRndTop.FindChildTraverse('result').AddClass('sb-timeline__segment__round--active');
            elRndBot.FindChildTraverse('result').SetImage('');
            elRndBot.FindChildTraverse('result').RemoveClass('sb-timeline__segment__round--active');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick').AddClass('sb-team--CT');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick__label').AddClass('sb-team--CT');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick').RemoveClass('sb-team--TERRORIST');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick__label').RemoveClass('sb-team--TERRORIST');
        }
        else if (roundData['result'].charAt(0) === 't') {
            if (bFlippedSides)
                m_topScore++;
            else
                m_botScore++;
            elRndBot.FindChildTraverse('result').SetImage(dictRoundResultImage[result]);
            elRndBot.FindChildTraverse('result').AddClass('sb-timeline__segment__round--active');
            elRndTop.FindChildTraverse('result').SetImage('');
            elRndTop.FindChildTraverse('result').RemoveClass('sb-timeline__segment__round--active');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick').AddClass('sb-team--TERRORIST');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick__label').AddClass('sb-team--TERRORIST');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick').RemoveClass('sb-team--CT');
            elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick__label').RemoveClass('sb-team--CT');
        }
        let _UpdateCasualties = (teamName, elRnd) => {
            if (_m_oTeams[teamName]) {
                let livingCount = teamName === 'CT' ? roundData.players_alive_CT : roundData.players_alive_TERRORIST;
                let nPlayers = 5;
                if (MockAdapter.GetGameModeInternalName(false) == 'scrimcomp2v2')
                    nPlayers = 2;
                for (let i = 1; i <= nPlayers; i++) {
                    let img = elRnd.FindChildTraverse('casualty-' + i);
                    if (!img)
                        break;
                    img.RemoveClass('hidden');
                    if (i > livingCount) {
                        img.AddClass('dead-casualty');
                    }
                    else {
                        img.RemoveClass('dead-casualty');
                    }
                }
            }
        };
        _UpdateCasualties('CT', elRndTop);
        _UpdateCasualties('TERRORIST', elRndBot);
    }
    function _ShowSurvivors(hide = false) {
        let elTimeline = _m_cP.FindChildInLayoutFile('id-sb-timeline__segments');
        if (!elTimeline || !elTimeline.IsValid())
            return;
        let arrPanelsToToggleTransparency = [];
        function CollectPanelsToToggleTransparency(el) {
            if (!el || !el.IsValid())
                return;
            if (el.Children())
                el.Children().forEach(CollectPanelsToToggleTransparency);
            if (el.GetAttributeString('data-casualty-mouse-over-toggle-transparency', 'false') == 'true')
                arrPanelsToToggleTransparency.push(el);
        }
        elTimeline.Children().forEach(CollectPanelsToToggleTransparency);
        arrPanelsToToggleTransparency.forEach(el => el.SetHasClass('transparent', hide));
    }
    function _Casualties_OnMouseOver() {
        if (GameInterfaceAPI.GetSettingString('cl_scoreboard_survivors_always_on') == '0')
            _ShowSurvivors();
    }
    function _Casualties_OnMouseOut() {
        if (GameInterfaceAPI.GetSettingString('cl_scoreboard_survivors_always_on') == '0')
            _ShowSurvivors(true);
        UiToolkitAPI.HideCustomLayoutTooltip('id-tooltip-sb-casualties');
    }
    function _RoundLossBonusMoneyForTeam(teamname) {
        let nLossAmount = MockAdapter.GetTeamNextRoundLossBonus(teamname);
        let nMaxLoss = parseInt(GameInterfaceAPI.GetSettingString('mp_consecutive_loss_max'));
        if (nLossAmount > nMaxLoss) {
            nLossAmount = nMaxLoss;
        }
        if (nLossAmount < 0) {
            nLossAmount = 0;
        }
        let nBaseAmount = parseInt(GameInterfaceAPI.GetSettingString('cash_team_loser_bonus'));
        let nConsecutiveBonus = parseInt(GameInterfaceAPI.GetSettingString('cash_team_loser_bonus_consecutive_rounds'));
        let nTotalAmount = nBaseAmount + (nLossAmount * nConsecutiveBonus);
        return nTotalAmount;
    }
    function _RoundLossBonusMoney_OnMouseOver_CT() {
        _m_cP.SetDialogVariable('round_loss_income_team', $.Localize('#counter-terrorists'));
        _m_cP.SetDialogVariableInt('round_loss_income_amount', _RoundLossBonusMoneyForTeam('CT'));
        let sTooltipText = $.Localize('#Scoreboard_lossmoneybonus_tooltip', _m_cP);
        UiToolkitAPI.ShowTextTooltip('id-sb-timeline__round-loss-bonus-money', sTooltipText);
    }
    function _RoundLossBonusMoney_OnMouseOut_CT() {
        UiToolkitAPI.HideTextTooltip();
    }
    function _RoundLossBonusMoney_OnMouseOver_TERRORIST() {
        _m_cP.SetDialogVariable('round_loss_income_team', $.Localize('#terrorists'));
        _m_cP.SetDialogVariableInt('round_loss_income_amount', _RoundLossBonusMoneyForTeam('TERRORIST'));
        let sTooltipText = $.Localize('#Scoreboard_lossmoneybonus_tooltip', _m_cP);
        UiToolkitAPI.ShowTextTooltip('id-sb-timeline__round-loss-bonus-money', sTooltipText);
    }
    function _RoundLossBonusMoney_OnMouseOut_TERRORIST() {
        UiToolkitAPI.HideTextTooltip();
    }
    function _UpdateTeamInfo(teamName) {
        let team = _m_oTeams[teamName];
        if (!team) {
            team = _m_oTeams[teamName] = new Team_t(teamName);
        }
        _m_cP.SetDialogVariable('sb_team_name--' + teamName, MockAdapter.GetTeamClanName(teamName));
        const teamLogoImagePath = MockAdapter.GetTeamLogoImagePath(teamName);
        if (teamLogoImagePath != '') {
            for (const elTeamLogoBackground of _m_cP.FindChildrenWithClassTraverse('sb-team-logo-background--' + teamName)) {
                elTeamLogoBackground.style.backgroundImage = `url("file://{images}${teamLogoImagePath}")`;
                elTeamLogoBackground.AddClass('sb-team-logo-bg');
            }
        }
        _m_cP.SetDialogVariableInt(teamName + '_alive', MockAdapter.GetTeamLivingPlayerCount(teamName));
        _m_cP.SetDialogVariableInt(teamName + '_total', MockAdapter.GetTeamTotalPlayerCount(teamName));
    }
    function _UpdateTeams() {
        let oScoreData = MockAdapter.GetScoreDataJSO();
        for (let team in _m_oTeams) {
            _UpdateTeamInfo(team);
            if (!oScoreData || !('teamdata' in oScoreData) || !(team in oScoreData['teamdata']))
                continue;
            const teamData = oScoreData.teamdata[team];
            _m_cP.SetDialogVariableInt('sb_team_score--' + team, teamData['score']);
            if ('score_1h' in teamData) {
                _m_cP.SetDialogVariableInt('sb_team_score_2--' + team, teamData['score_1h']);
            }
            if ('score_2h' in teamData) {
                _m_cP.SetDialogVariableInt('sb_team_score_3--' + team, teamData['score_2h']);
            }
            if ('score_ot' in teamData) {
                _m_cP.SetDialogVariableInt('sb_team_score_ot--' + team, teamData['score_ot']);
            }
            let elOTScore = _m_cP.FindChildTraverse('id-sb-timeline__score_ot');
            if (elOTScore && elOTScore.IsValid()) {
                elOTScore.SetHasClass('hidden', !('score_ot' in teamData));
                elOTScore.SetHasClass('fade', !('score_ot' in teamData));
            }
        }
    }
    function _InitClassicTeams() {
        _UpdateTeamInfo('TERRORIST');
        _UpdateTeamInfo('CT');
    }
    let m_topScore = 0;
    let m_botScore = 0;
    function _UpdateAllRounds() {
        let jsoTime = MockAdapter.GetTimeDataJSO();
        let oScoreData = MockAdapter.GetScoreDataJSO();
        if (!jsoTime)
            return;
        if (!oScoreData)
            return;
        if (!_SupportsTimeline(jsoTime))
            return;
        let firstRound = jsoTime['first_round_this_period'];
        let lastRound = jsoTime['last_round_this_period'];
        m_topScore = 0;
        m_botScore = 0;
        if (jsoTime['overtime'] > 0) {
            m_topScore = (jsoTime['maxrounds'] + (jsoTime['overtime'] - 1) * jsoTime['maxrounds_overtime']) / 2;
            m_botScore = (jsoTime['maxrounds'] + (jsoTime['overtime'] - 1) * jsoTime['maxrounds_overtime']) / 2;
        }
        for (let rnd = firstRound; rnd <= lastRound; rnd++) {
            _UpdateRound(rnd, oScoreData, jsoTime);
        }
    }
    function _UpdateScore_Classic() {
        if (Object.keys(_m_oTeams).length === 0) {
            _InitClassicTeams();
        }
        _UpdateTeams();
        let jsoTime = MockAdapter.GetTimeDataJSO();
        if (!jsoTime)
            return;
        let currentRound = jsoTime['rounds_played'] + 1;
        _m_cP.SetDialogVariable('match_phase', $.Localize('#gamephase_' + jsoTime['gamephase']));
        _m_cP.SetDialogVariable('rounds_remaining', jsoTime['rounds_remaining'].toString());
        _m_cP.SetDialogVariableInt('scoreboard_ot', jsoTime['overtime']);
        _m_cP.SetHasClass('sb-tournament-match', MatchStatsAPI.IsTournamentMatch());
        let bResetTimeline = false;
        if (_m_maxRounds != jsoTime['maxrounds_this_period']) {
            bResetTimeline = true;
            _m_maxRounds = jsoTime['maxrounds_this_period'];
        }
        if (_m_areTeamsSwapped !== MockAdapter.AreTeamsPlayingSwitchedSides()) {
            bResetTimeline = true;
            _m_areTeamsSwapped = MockAdapter.AreTeamsPlayingSwitchedSides();
        }
        if (!_SupportsTimeline(jsoTime)) {
            bResetTimeline = true;
        }
        if (_m_overtime != jsoTime['overtime']) {
            _m_overtime = jsoTime['overtime'];
            bResetTimeline = true;
        }
        if (bResetTimeline || !(currentRound in _m_RoundUpdated)) {
            if (bResetTimeline) {
                _ResetTimeline();
            }
            _UpdateAllRounds();
            _m_RoundUpdated[currentRound] = true;
        }
        else {
            let oScoreData = MockAdapter.GetScoreDataJSO();
            if (oScoreData) {
                _UpdateRound(currentRound - 1, oScoreData, jsoTime);
            }
        }
        _UpdateRoundLossBonus();
    }
    function _InsertTimelineDivider() {
        let elTimeline = _m_cP.FindChildInLayoutFile('id-sb-timeline__segments');
        if (!elTimeline || !elTimeline.IsValid())
            return;
        let elDivider = $.CreatePanel('Panel', elTimeline, 'id-sb-timeline__divider');
        elDivider.AddClass('sb-timeline__divider');
    }
    function _InitTimelineSegment(startRound, endRound, phase) {
        let elTimeline = _m_cP.FindChildInLayoutFile('id-sb-timeline__segments');
        if (!elTimeline || !elTimeline.IsValid())
            return;
        elTimeline.AddClass('sb-team-tint');
        let id = 'id-sb-timeline__segment--' + phase;
        let elSegment = elTimeline.FindChildTraverse(id);
        if (!elSegment || !elSegment.IsValid()) {
            elSegment = $.CreatePanel('Panel', elTimeline, id);
            elSegment.BLoadLayoutSnippet('snippet_scoreboard-classic__timeline__segment');
        }
        let elRoundContainer = elSegment.FindChildTraverse('id-sb-timeline__round-container');
        if (elRoundContainer && elRoundContainer.IsValid()) {
            for (let rnd = startRound; rnd <= endRound; rnd++) {
                let elRnd = elSegment.FindChildTraverse(rnd.toString());
                if (!elRnd || !elRnd.IsValid()) {
                    elRnd = $.CreatePanel('Panel', elRoundContainer, rnd.toString());
                    elRnd.BLoadLayoutSnippet('snippet_scoreboard-classic__timeline__segment__round');
                    let elTop = elRnd.FindChildTraverse('id-sb-timeline__segment__round--top');
                    elTop.BLoadLayoutSnippet('snippet_scoreboard-classic__timeline__segment__round__data');
                    let elBot = elRnd.FindChildTraverse('id-sb-timeline__segment__round--bot');
                    elBot.BLoadLayoutSnippet('snippet_scoreboard-classic__timeline__segment__round__data');
                    if (rnd % 5 == 0) {
                        elRnd.FindChildTraverse('id-sb-timeline__segment__round__tick__label').text = rnd.toString();
                    }
                }
            }
        }
        if (MockAdapter.AreTeamsPlayingSwitchedSides() !== MockAdapter.AreTeamsPlayingSwitchedSidesInRound(endRound)) {
            let elCTScore = elSegment.FindChildTraverse('id-sb-timeline__segment__score__ct');
            let elTScore = elSegment.FindChildTraverse('id-sb-timeline__segment__score__t');
            if (elCTScore && elCTScore.IsValid()) {
                elCTScore.RemoveClass('sb-color--CT');
                elCTScore.AddClass('sb-color--TERRORIST');
            }
            if (elTScore && elTScore.IsValid()) {
                elTScore.RemoveClass('sb-color--TERRORIST');
                elTScore.AddClass('sb-color--CT');
            }
        }
    }
    function _SupportsTimeline(jsoTime) {
        if (jsoTime == undefined)
            jsoTime = MockAdapter.GetTimeDataJSO();
        let roundCountToEvaluate = jsoTime['maxrounds_this_period'];
        return (roundCountToEvaluate <= 30);
    }
    function _UpdateRoundLossBonus() {
        let elRoundLossBonusMoney = _m_cP.FindChildInLayoutFile('id-sb-timeline__round-loss-bonus-money');
        if (elRoundLossBonusMoney && elRoundLossBonusMoney.IsValid()) {
            elRoundLossBonusMoney.AddClass('hidden');
            if (parseInt(GameInterfaceAPI.GetSettingString('mp_consecutive_loss_max')) > 0 &&
                parseInt(GameInterfaceAPI.GetSettingString('cash_team_loser_bonus_consecutive_rounds')) > 0) {
                let nLossT = MockAdapter.GetTeamNextRoundLossBonus('TERRORIST');
                let nLossCT = MockAdapter.GetTeamNextRoundLossBonus('CT');
                if (nLossT >= 0 && nLossCT >= 0) {
                    elRoundLossBonusMoney.RemoveClass('hidden');
                    for (let nClassIdx = 1; nClassIdx <= 4; ++nClassIdx) {
                        elRoundLossBonusMoney.SetHasClass('sb-timeline__round-loss-bonus-money__TERRORIST' + nClassIdx, nLossT >= nClassIdx);
                    }
                    for (let nClassIdx = 1; nClassIdx <= 4; ++nClassIdx) {
                        elRoundLossBonusMoney.SetHasClass('sb-timeline__round-loss-bonus-money__CT' + nClassIdx, nLossCT >= nClassIdx);
                    }
                }
            }
        }
    }
    function _ResetTimeline() {
        _UpdateRoundLossBonus();
        let elTimeline = _m_cP.FindChildInLayoutFile('id-sb-timeline__segments');
        if (!elTimeline || !elTimeline.IsValid())
            return;
        elTimeline.RemoveAndDeleteChildren();
        let jsoTime = MockAdapter.GetTimeDataJSO();
        if (!jsoTime)
            return;
        if (!_SupportsTimeline(jsoTime))
            return;
        let firstRound;
        let lastRound;
        let midRound;
        firstRound = jsoTime['first_round_this_period'];
        lastRound = jsoTime['last_round_this_period'];
        let elLabel = _m_cP.FindChildTraverse('id-sb-timeline__round-label');
        if (elLabel && elLabel.IsValid()) {
            elLabel.SetHasClass('hidden', jsoTime['overtime'] == 0);
        }
        midRound = firstRound + Math.ceil((lastRound - firstRound) / 2) - 1;
        if (MockAdapter.HasHalfTime()) {
            _InitTimelineSegment(firstRound, midRound, 'first-half');
            _InsertTimelineDivider();
            _InitTimelineSegment(midRound + 1, lastRound, 'second-half');
        }
        else {
            _InitTimelineSegment(firstRound, lastRound, 'no-halves');
        }
        _UpdateAllRounds();
        if (GameInterfaceAPI.GetSettingString('cl_scoreboard_survivors_always_on') == '1')
            _ShowSurvivors();
    }
    function _UnborrowMusicKit() {
        GameInterfaceAPI.SetSettingString('cl_borrow_music_from_player_slot', '-1');
        let oLocalPlayer = _m_oPlayers.GetPlayerByXuid(GetLocalPlayerId());
        _m_oUpdateStatFns['musickit'](oLocalPlayer, true);
    }
    function UpdateCasterButtons() {
        for (let i = 0; i < 4; i++) {
            let buttonName = '#spec-button' + (i + 1);
            let bActive = true;
            switch (i) {
                default:
                case 0:
                    bActive = !!GetCasterIsCameraman();
                    break;
                case 1:
                    bActive = !!GetCasterIsHeard();
                    break;
                case 2:
                    bActive = !!GetCasterControlsXray();
                    break;
                case 3:
                    bActive = !!GetCasterControlsUI();
                    break;
            }
            ToggleCasterButtonActive(buttonName, bActive);
        }
    }
    function ToggleCasterButtonActive(buttonName, bActive) {
        let button = $(buttonName);
        if (button == null)
            return;
        if (bActive == false && button.BHasClass('sb-spectator-control-button-notactive') == false) {
            button.AddClass('sb-spectator-control-button-notactive');
        }
        else if (bActive == true && button.BHasClass('sb-spectator-control-button-notactive') == true) {
            button.RemoveClass('sb-spectator-control-button-notactive');
        }
    }
    function _ToggleSetCasterIsCameraman() {
        $.DispatchEvent('CSGOPlaySoundEffect', 'generic_button_press', 'MOUSE');
        let nCameraMan = parseInt(GameInterfaceAPI.GetSettingString('spec_autodirector_cameraman'));
        if (GetCasterIsCameraman()) {
            GameStateAPI.SetCasterIsCameraman(0);
        }
        else {
            GameStateAPI.SetCasterIsCameraman(nCameraMan);
        }
        UpdateCasterButtons();
    }
    function _ToggleSetCasterIsHeard() {
        $.DispatchEvent('CSGOPlaySoundEffect', 'generic_button_press', 'MOUSE');
        let nCameraMan = parseInt(GameInterfaceAPI.GetSettingString('spec_autodirector_cameraman'));
        if (GetCasterIsHeard()) {
            GameStateAPI.SetCasterIsHeard(0);
        }
        else {
            GameStateAPI.SetCasterIsHeard(nCameraMan);
        }
        UpdateCasterButtons();
    }
    function _ToggleSetCasterControlsXray() {
        $.DispatchEvent('CSGOPlaySoundEffect', 'generic_button_press', 'MOUSE');
        let nCameraMan = parseInt(GameInterfaceAPI.GetSettingString('spec_autodirector_cameraman'));
        if (GetCasterControlsXray()) {
            GameStateAPI.SetCasterControlsXray(0);
            ToggleCasterButtonActive('#spec-button3', false);
        }
        else {
            GameStateAPI.SetCasterControlsXray(nCameraMan);
            ToggleCasterButtonActive('#spec-button3', true);
        }
    }
    function _ToggleSetCasterControlsUI() {
        $.DispatchEvent('CSGOPlaySoundEffect', 'generic_button_press', 'MOUSE');
        let nCameraMan = parseInt(GameInterfaceAPI.GetSettingString('spec_autodirector_cameraman'));
        if (GetCasterControlsUI()) {
            GameStateAPI.SetCasterControlsUI(0);
        }
        else {
            GameStateAPI.SetCasterControlsUI(nCameraMan);
        }
        UpdateCasterButtons();
    }
    function _CycleStats() {
        if (_m_dataSetGetCount === 0)
            return;
        {
            _m_dataSetCurrent++;
            if (_m_dataSetCurrent >= _m_dataSetGetCount)
                _m_dataSetCurrent = 0;
        }
        let elLabelSets = $('#id-sb-row__sets');
        for (let i = 0; i < elLabelSets.Children().length; i++) {
            let elChild = elLabelSets.Children()[i];
            if (elChild.id == 'id-sb-labels-set-' + _m_dataSetCurrent) {
                elChild.RemoveClass('hidden');
            }
            else {
                elChild.AddClass('hidden');
            }
        }
        for (let i = 0; i < _m_oPlayers.GetCount(); i++) {
            let elPlayer = _m_oPlayers.GetPlayerByIndex(i).m_elPlayer;
            if (elPlayer && elPlayer.IsValid()) {
                let elSetContainer = elPlayer.FindChildTraverse('id-sb-row__set-container');
                if (elSetContainer && elSetContainer.IsValid()) {
                    for (let j = 0; j < elSetContainer.Children().length; j++) {
                        let elChild = elSetContainer.Children()[j];
                        if (elChild.id == 'id-sb-set-' + _m_dataSetCurrent) {
                            elChild.RemoveClass('hidden');
                        }
                        else {
                            elChild.AddClass('hidden');
                        }
                    }
                }
            }
        }
    }
    function _MuteVoice() {
        GameInterfaceAPI.ConsoleCommand('voice_modenable_toggle');
        $.Schedule(0.1, _UpdateMuteVoiceState);
    }
    function _UpdateMuteVoiceState() {
        let muteState = GameInterfaceAPI.GetSettingString('voice_modenable') === '1';
        let elMuteImage = _m_cP.FindChildInLayoutFile('id-sb-meta__mutevoice__image');
        if (!elMuteImage)
            return;
        if (muteState) {
            elMuteImage.SetImage('file://{images}/icons/ui/unmuted.svg');
        }
        else {
            elMuteImage.SetImage('file://{images}/icons/ui/muted.svg');
        }
    }
    function _BlockUgc() {
        let ugcBlockState = GameInterfaceAPI.GetSettingString('cl_hide_avatar_images') !== '0' ||
            GameInterfaceAPI.GetSettingString('cl_sanitize_player_names') !== '0';
        if (ugcBlockState) {
            GameInterfaceAPI.SetSettingString('cl_sanitize_player_names', '0');
            GameInterfaceAPI.SetSettingString('cl_hide_avatar_images', '0');
        }
        else {
            GameInterfaceAPI.SetSettingString('cl_sanitize_player_names', '1');
            GameInterfaceAPI.SetSettingString('cl_hide_avatar_images', '2');
        }
        $.Schedule(0.1, _UpdateUgcState);
    }
    function _UpdateUgcState() {
        let ugcBlockState = GameInterfaceAPI.GetSettingString('cl_hide_avatar_images') !== '0' ||
            GameInterfaceAPI.GetSettingString('cl_sanitize_player_names') !== '0';
        let elBlockUgcImage = _m_cP.FindChildInLayoutFile('id-sb-meta__blockugc__image');
        if (!elBlockUgcImage)
            return;
        if (ugcBlockState) {
            elBlockUgcImage.SetImage('file://{images}/icons/ui/votekick.svg');
        }
        else {
            elBlockUgcImage.SetImage('file://{images}/icons/ui/player.svg');
        }
    }
    function _CreateLabelsForRow(el) {
        if (!el || !el.IsValid())
            return;
        for (let i = 0; i < el.Children().length; i++) {
            _CreateLabelsForRow(el.Children()[i]);
        }
        let stat = el.GetAttributeString('data-stat', '');
        let set = el.GetAttributeString('data-set', '');
        let isHidden = el.GetAttributeString('data-hidden', '');
        const noLabel = el.GetAttributeString('no-label', 'false');
        if (stat != '' && !(noLabel === 'true'))
            _CreateLabelForStat(stat, set, isHidden);
    }
    function _GetSortOrderForMode(mode) {
        if (GameStateAPI.IsQueuedMatchmakingMode_Team())
            return sortOrder_tmm;
        switch (mode) {
            case 'deathmatch':
                if (GameInterfaceAPI.GetSettingString('mp_dm_teammode') !== '0') {
                    return sortOrder_default;
                }
                return sortOrder_dm;
            case 'competitive':
            case 'premier':
                return sortOrder_tmm;
            case 'gungameprogressive':
                return sortOrder_gg;
            default:
                return sortOrder_default;
        }
    }
    function _Initialize() {
        _Reset();
        let jsoTime = MockAdapter.GetTimeDataJSO();
        if (!jsoTime)
            return;
        let scoreboardTemplate;
        let mode = MockAdapter.GetGameModeInternalName(false);
        let skirmish = MockAdapter.GetGameModeInternalName(true);
        if (mode == 'deathmatch') {
            if (GameInterfaceAPI.GetSettingString('mp_teammates_are_enemies') !== '0') {
                skirmish = 'ffadm';
            }
            else if (GameInterfaceAPI.GetSettingString('mp_dm_teammode') !== '0') {
                skirmish = 'teamdm';
            }
        }
        switch (mode.toLowerCase()) {
            case 'premier':
            case 'competitive':
            case 'scrimcomp2v2':
                scoreboardTemplate = 'snippet_scoreboard-classic--with-timeline--half-times';
                break;
            case 'deathmatch':
                if (skirmish == 'teamdm') {
                    scoreboardTemplate = 'snippet_scoreboard-classic--no-timeline';
                }
                else {
                    scoreboardTemplate = 'snippet_scoreboard--no-teams';
                }
                break;
            case 'gungameprogressive':
            case 'training':
                scoreboardTemplate = 'snippet_scoreboard--no-teams';
                break;
            case 'cooperative':
                scoreboardTemplate = 'snippet_scoreboard--cooperative';
                break;
            case 'coopmission':
                scoreboardTemplate = 'snippet_scoreboard--coopmission';
                break;
            case 'casual':
                if (skirmish == 'flyingscoutsman') {
                    scoreboardTemplate = 'snippet_scoreboard-classic--with-timeline--no-half-times';
                }
                else {
                    scoreboardTemplate = 'snippet_scoreboard-classic--no-timeline';
                }
                break;
            default:
                scoreboardTemplate = 'snippet_scoreboard-classic--no-timeline';
                break;
        }
        _Helper_LoadSnippet(_m_cP, scoreboardTemplate);
        if (MockAdapter.IsDemoOrHltv())
            _m_cP.AddClass('IsDemoOrHltv');
        if (MatchStatsAPI.IsTournamentMatch())
            _m_cP.AddClass('IsTournamentMatch');
        _m_sortOrder = _GetSortOrderForMode(mode);
        let temp = $.CreatePanel('Panel', _m_cP, 'temp');
        _Helper_LoadSnippet(temp, _GetPlayerRowForGameMode());
        temp.visible = false;
        _CreateLabelsForRow(temp);
        temp.DeleteAsync(.0);
        _ResetTimeline();
        _m_bInit = true;
        _m_cP.SetDialogVariable('server_name', '');
        _UpdateHLTVViewerNumber(0);
        _UpdateMatchInfo();
    }
    function _RankRevealAll() {
        for (let i = 0; i < _m_oPlayers.GetCount(); i++) {
            let oPlayer = _m_oPlayers.GetPlayerByIndex(i);
            if (typeof (_m_oUpdateStatFns['skillgroup']) === 'function')
                _m_oUpdateStatFns['skillgroup'](oPlayer, true);
        }
    }
    function _UpdateScore() {
        switch (MockAdapter.GetGameModeInternalName(false)) {
            case 'competitive':
            case 'premier':
                _UpdateScore_Classic();
                break;
            case 'deathmatch':
                if (GameInterfaceAPI.GetSettingString('mp_dm_teammode') !== '0') {
                    _UpdateScore_Classic();
                }
                break;
            default:
            case 'casual':
                _UpdateScore_Classic();
                break;
        }
    }
    function _UpdateJob() {
        _UpdateMatchInfo();
        _UpdateScore();
        _UpdateNextPlayer();
    }
    function _UpdateEverything() {
        if (!_m_bInit) {
            _Initialize();
        }
        _UpdateMuteVoiceState();
        _UpdateUgcState();
        _UpdateMatchInfo();
        _UpdateScore();
        _UpdateAllPlayers_delayed(true);
        _UpdateSpectatorButtons();
    }
    function _OnMouseActive() {
        $.GetContextPanel().AddClass('mouse-active');
    }
    function _OnMouseInactive() {
        $.GetContextPanel().RemoveClass('mouse-active');
        UiToolkitAPI.HideTextTooltip();
    }
    function _CloseScoreboard() {
        if (_m_updatePlayerHandler) {
            $.UnregisterForUnhandledEvent('Scoreboard_UpdatePlayerByPlayerSlot', _m_updatePlayerHandler);
            _m_updatePlayerHandler = null;
        }
        $.DispatchEvent('DismissAllContextMenus');
        _OnMouseInactive();
        _UnregisterEvents();
    }
    function _OpenScoreboard() {
        _UpdateEverything();
        _ShowSurvivors((GameInterfaceAPI.GetSettingString('cl_scoreboard_survivors_always_on') == '0'));
        if (!_m_updatePlayerHandler) {
            _m_updatePlayerHandler = $.RegisterForUnhandledEvent('Scoreboard_UpdatePlayerByPlayerSlot', _UpdatePlayerByPlayerSlot_delayed);
        }
        _RegisterEvents();
    }
    function GetFreeForAllTopThreePlayers() {
        _UpdateEverything();
        if (!$('#Scoreboard'))
            return [undefined, undefined, undefined];
        let elTeam = $('#Scoreboard').FindChildInLayoutFile('players-table-ANY');
        if (elTeam && elTeam.IsValid()) {
            const players = elTeam.Children();
            return [players[0]?.m_xuid || '0', players[1]?.m_xuid || '0', players[2]?.m_xuid || '0'];
        }
        return [undefined, undefined, undefined];
    }
    Scoreboard.GetFreeForAllTopThreePlayers = GetFreeForAllTopThreePlayers;
    function GetCasterIsCameraman() {
        let nCameraMan = parseInt(GameInterfaceAPI.GetSettingString('spec_autodirector_cameraman'));
        let bQ = (MockAdapter.IsDemoOrHltv() && nCameraMan != 0 && MockAdapter.IsHLTVAutodirectorOn());
        return bQ;
    }
    function GetCasterIsHeard() {
        if (MockAdapter.IsDemoOrHltv()) {
            return !!parseInt(GameInterfaceAPI.GetSettingString('voice_caster_enable'));
        }
        return false;
    }
    function GetCasterControlsXray() {
        let bXRay = MockAdapter.IsDemoOrHltv() && parseInt(GameInterfaceAPI.GetSettingString('spec_cameraman_xray'));
        return bXRay;
    }
    function GetCasterControlsUI() {
        let bSpecCameraMan = parseInt(GameInterfaceAPI.GetSettingString('spec_cameraman_ui'));
        let bQ = (MockAdapter.IsDemoOrHltv() && bSpecCameraMan);
        return bQ;
    }
    function _ApplyPlayerCrosshairCode(panel, xuid) {
        UiToolkitAPI.ShowGenericPopupYesNo($.Localize('#tooltip_copycrosshair'), $.Localize('#GameUI_Xhair_Copy_Code_Confirm'), '', () => { let code = GameStateAPI.GetCrosshairCode(xuid); MyPersonaAPI.BApplyCrosshairCode(code); }, () => { });
    }
    const events = [
        ['Scoreboard_UnborrowMusicKit', _UnborrowMusicKit],
        ['Scoreboard_Casualties_OnMouseOver', _Casualties_OnMouseOver],
        ['Scoreboard_Casualties_OnMouseOut', _Casualties_OnMouseOut],
        ['Scoreboard_RoundLossBonusMoney_OnMouseOver_CT', _RoundLossBonusMoney_OnMouseOver_CT],
        ['Scoreboard_RoundLossBonusMoney_OnMouseOut_CT', _RoundLossBonusMoney_OnMouseOut_CT],
        ['Scoreboard_RoundLossBonusMoney_OnMouseOver_TERRORIST', _RoundLossBonusMoney_OnMouseOver_TERRORIST],
        ['Scoreboard_RoundLossBonusMoney_OnMouseOut_TERRORIST', _RoundLossBonusMoney_OnMouseOut_TERRORIST],
        ['Scoreboard_MuteVoice', _MuteVoice],
        ['Scoreboard_BlockUgc', _BlockUgc],
        ['Scoreboard_OnMouseActive', _OnMouseActive],
        ['Scoreboard_ApplyPlayerCrosshairCode', _ApplyPlayerCrosshairCode]
    ];
    let eventHandles = [];
    function _RegisterEvents() {
        events.forEach(function (arrEvent, idx) {
            eventHandles[idx] = $.RegisterForUnhandledEvent(arrEvent[0], arrEvent[1]);
        });
    }
    function _UnregisterEvents() {
        events.forEach(function (arrEvent, idx) {
            $.UnregisterForUnhandledEvent(arrEvent[0], eventHandles[idx]);
        });
    }
    if (!$.GetContextPanel().Data().bEventsRegistered) {
        $.RegisterEventHandler('OnOpenScoreboard', $.GetContextPanel(), _OpenScoreboard);
        $.RegisterEventHandler('OnCloseScoreboard', $.GetContextPanel(), _CloseScoreboard);
        $.RegisterEventHandler('Scoreboard_UpdateJob', $.GetContextPanel(), _UpdateJob);
        $.RegisterEventHandler('Scoreboard_ResetAndInit', $.GetContextPanel(), _Initialize);
        $.RegisterForUnhandledEvent('GameState_OnLevelLoad', _Initialize);
        $.RegisterForUnhandledEvent('Scoreboard_CycleStats', _CycleStats);
        $.RegisterForUnhandledEvent('Scoreboard_ToggleSetCasterIsCameraman', _ToggleSetCasterIsCameraman);
        $.RegisterForUnhandledEvent('Scoreboard_ToggleSetCasterIsHeard', _ToggleSetCasterIsHeard);
        $.RegisterForUnhandledEvent('Scoreboard_ToggleSetCasterControlsXray', _ToggleSetCasterControlsXray);
        $.RegisterForUnhandledEvent('Scoreboard_ToggleSetCasterControlsUI', _ToggleSetCasterControlsUI);
        $.RegisterForUnhandledEvent('GameState_RankRevealAll', _RankRevealAll);
        $.RegisterForUnhandledEvent('Scoreboard_UpdateHLTVViewers', _UpdateHLTVViewerNumber);
        $.GetContextPanel().Data().bEventsRegistered = true;
    }
})(Scoreboard || (Scoreboard = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NvcmVib2FyZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2NvbnRlbnQvY3Nnby9wYW5vcmFtYS9zY3JpcHRzL3Njb3JlYm9hcmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGtDQUFrQztBQUNsQyx3Q0FBd0M7QUFDeEMsc0RBQXNEO0FBQ3RELDZDQUE2QztBQUM3Qyx5Q0FBeUM7QUFDekMsd0NBQXdDO0FBQ3hDLHNDQUFzQztBQUN0QyxpRUFBaUU7QUFzQmpFLElBQVUsVUFBVSxDQXF4R25CO0FBcnhHRCxXQUFVLFVBQVU7SUFtQm5CLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxlQUFlLEVBQXNCLENBQUM7SUFFdEQsSUFBSSxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7SUFDMUIsU0FBUyxnQkFBZ0I7UUFFeEIsSUFBSyxnQkFBZ0IsS0FBSyxFQUFFO1lBQzNCLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQ3RELE9BQU8sZ0JBQWdCLENBQUM7SUFDekIsQ0FBQztJQVlELE1BQU0sTUFBTTtRQUVYLHFCQUFxQixHQUF1RTtZQUMzRixRQUFRLEVBQUUsRUFBRTtZQUNaLFNBQVMsRUFBRSxFQUFFO1lBQ2IsVUFBVSxFQUFFLEVBQUU7U0FDZCxDQUFDO1FBQ0YsVUFBVSxDQUFTO1FBRW5CLFlBQWEsUUFBZ0I7WUFFNUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxRQUFRLENBQUM7UUFDNUIsQ0FBQztRQUdELG9CQUFvQjtZQUVuQixLQUFNLElBQUksSUFBSSxJQUFJLENBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQXFCLEVBQ3hFO2dCQUNDLElBQUksQ0FBQyx1QkFBdUIsQ0FBRSxJQUFJLENBQUUsQ0FBQztnQkFFckMsSUFBSSxDQUFDLHFCQUFxQixDQUFFLGNBQWMsQ0FBRSxJQUFJLENBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFFLENBQUM7Z0JBRWxFLGNBQWMsQ0FBRSxJ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