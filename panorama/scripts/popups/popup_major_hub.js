"use strict";
/// <reference path="../csgo.d.ts" />
/// <reference path="../common/licenseutil.ts" />
/// <reference path="../common/eventutil.ts" />
/// <reference path="../common/store_items.ts" />
/// <reference path="../generated/items_event_current_generated_store.d.ts" />
/// <reference path="../generated/items_event_current_generated_store.ts" />
/// <reference path="../common/xpshop_tile_weapon_camera_settings.ts" />
/// <reference path="../popups/popup_acknowledge_item.ts" />
/// <reference path="../itemtile_store.ts" />
/// <reference path="../tournaments/predictions_timer.ts" />
/// <reference path="../tournaments/predictions_group_stage.ts" />
/// <reference path="../tournaments/predictions_bracket_stage.ts" />
var PopupMajorHub;
(function (PopupMajorHub) {
    const _m_cp = $.GetContextPanel();
    const _m_elPickemPages = _m_cp.FindChildInLayoutFile('id-pickem-pages');
    let _m_timeoutHandle;
    let _m_eventId;
    let _m_tournamentId;
    let _m_inventoryUpdatedHandler;
    let m_selectedPage;
    let m_setDefaultTab;
    let m_redeemAvailable = 0;
    let m_oPageData = {};
    m_oPageData.hasAlreadyInit = [];
    function ClosePopup() {
        if (_m_elPickemPages.IsValid() && _m_elPickemPages) {
            m_oPageData.hasAlreadyInit.forEach(id => {
                let elPage = _m_elPickemPages.FindChild(id);
                if (elPage && elPage.IsValid()) {
                    let elBtn = elPage.FindChildInLayoutFile('id-predictions-apply-btn').FindChild('id-apply-btn');
                    if (elBtn.enabled) {
                        elBtn.AddClass('activated-by-program');
                        $.DispatchEvent("Activated", elBtn, "program");
                    }
                }
            });
        }
        PopupMajorHub.DeleteDragItem();
        $.DispatchEvent('CSGOPlaySoundEffect', 'inventory_inspect_close', 'MOUSE');
        _m_cp.SetReadyForDisplay(false);
        $.DispatchEvent('UIPopupButtonClicked', '');
        $.DispatchEvent('ContextMenuEvent', '');
        UiToolkitAPI.HideTextTooltip();
    }
    PopupMajorHub.ClosePopup = ClosePopup;
    function LeaderboardPopup() {
        UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_leaderboards.xml', 'type=official_leaderboard_pickem_' + g_ActiveTournamentInfo.location + '_team.friends' +
            '&' + 'titleoverride=#CSGO_PickEm_Leaderboard_Title' +
            '&' + 'points-title=#tournament_coin_completed_challenges' +
            '&' + 'popup-style=major-hub-popup-leaderboard' +
            '&' + 'eventid=' + _m_eventId);
    }
    PopupMajorHub.LeaderboardPopup = LeaderboardPopup;
    function Init() {
        let eventId = $.GetContextPanel().GetAttributeString('eventid', '') ? parseInt($.GetContextPanel().GetAttributeString('eventid', '')) : -1;
        if (eventId < 0) {
            ClosePopup();
            return;
        }
        ReadyForDisplay();
    }
    PopupMajorHub.Init = Init;
    function ReadyForDisplay() {
        if (!MyPersonaAPI.IsConnectedToGC()) {
            ClosePopup();
            return;
        }
        let restrictions = LicenseUtil.GetCurrentLicenseRestrictions();
        if (restrictions) {
            ClosePopup();
            return;
        }
        if (!_m_inventoryUpdatedHandler) {
            _m_inventoryUpdatedHandler = $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_InventoryUpdated', OnInventoryUpdated);
        }
        let eventId = $.GetContextPanel().GetAttributeString('eventid', '') ? parseInt($.GetContextPanel().GetAttributeString('eventid', '')) : -1;
        if (eventId < 0) {
            return;
        }
        _m_eventId = eventId;
        SavePicksButton._m_eventId = eventId;
        _m_tournamentId = 'tournament:' + _m_eventId;
        if (_m_eventId > 22) {
            _m_cp.SetHasClass('major-' + _m_eventId, true);
        }
        SetUpHubBasedOnEventId();
    }
    function UnreadyForDisplay() {
        if (_m_inventoryUpdatedHandler) {
            $.UnregisterForUnhandledEvent('PanoramaComponent_MyPersona_InventoryUpdated', _m_inventoryUpdatedHandler);
            _m_inventoryUpdatedHandler = null;
        }
    }
    function SetUpHubBasedOnEventId() {
        _UpdateTournamentTitle();
        _UpdateChallenges();
        _SetUpSpray();
        _SetBackgroundImages();
        let bItemsForSale = _ItemsForSale();
        _m_cp.SetHasClass('no-items-on-sale', !bItemsForSale);
        if (bItemsForSale) {
            _UpdateStoreBannar();
        }
        LoadPickEmData();
        SetUpTournamentControlRoom();
        InitializeEmbeddedLeaderboard();
    }
    function SetUpTournamentControlRoom() {
        var elBtn = _m_cp.FindChildInLayoutFile('JsTournamentOperatorBtn');
        var bCanControl = false;
        if (MyPersonaAPI.GetMyOfficialTournamentName() &&
            g_ActiveTournamentInfo.eventid === _m_eventId) {
            bCanControl = true;
            elBtn.SetPanelEvent('onactivate', function () {
                UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_tournament_controlroom.xml', 'type=matches' +
                    '&' + 'eventid=tournament:' + _m_eventId +
                    '&' + 'titleoverride=#Control');
            });
        }
        elBtn.SetHasClass('hidden', !bCanControl);
    }
    function InitializeEmbeddedLeaderboard() {
        let elLeaderboard = _m_cp.FindChildInLayoutFile('id-leaderboard');
        if (elLeaderboard && elLeaderboard.BHasClass('hidden')) {
            elLeaderboard.SetAttributeString("type", 'official_leaderboard_pickem_' + g_ActiveTournamentInfo.location + '_team.friends');
            elLeaderboard.SetAttributeString("titleoverride", '#CSGO_TournamentHub_FriendsCoinLeaderboards');
            elLeaderboard.SetAttributeString("points-title", '#tournament_coin_completed_challenges');
            elLeaderboard.SetAttributeInt("limitrows", 4);
            elLeaderboard.BLoadLayout('file://{resources}/layout/popups/popup_leaderboards.xml', true, false);
            elLeaderboard.RemoveClass('hidden');
            elLeaderboard.AddClass('leaderboard_embedded');
            elLeaderboard.RemoveClass('Hidden');
        }
    }
    function SetDefaultTab() {
        let passItemId = InventoryAPI.GetActiveTournamentCoinItemId(_m_eventId * -1);
        let coinItemId = InventoryAPI.GetActiveTournamentCoinItemId(_m_eventId);
        if ((!coinItemId || coinItemId === '0') && (passItemId && passItemId !== '0') && !m_setDefaultTab)
            OpenPassActivate(passItemId);
        let elLastActiveSection;
        for (let i = g_ActiveTournamentInfo.num_stages_with_swiss; i >= 0; --i) {
            let sectionId = PredictionsAPI.GetEventSectionIDByIndex(_m_tournamentId, i);
            if (PredictionsAPI.GetSectionIsActive(_m_tournamentId, sectionId) === true) {
                let elNavBtn = _m_cp.FindChildInLayoutFile('id-pickem-nav-stage' + i);
                if (elNavBtn && elNavBtn.IsValid()) {
                    elNavBtn.SetHasClass('active', true);
                    elLastActiveSection = elNavBtn;
                }
                else {
                    elNavBtn.SetHasClass('active', false);
                }
            }
        }
        if (elLastActiveSection && elLastActiveSection.IsValid()) {
            $.DispatchEvent("Activated", elLastActiveSection, "mouse");
        }
        else {
            let elNavBtn = _m_cp.FindChildInLayoutFile('id-pickem-nav-stage' + g_ActiveTournamentInfo.num_stages_with_swiss);
            $.DispatchEvent("Activated", elNavBtn, "mouse");
        }
        m_setDefaultTab = true;
        return;
    }
    function _UpdateTournamentTitle() {
        _m_cp.SetDialogVariable('tournament_name', $.Localize('#CSGO_Tournament_Event_NameShort_' + _m_eventId));
        _m_cp.FindChildInLayoutFile('id-major-logo').SetImage('file://{images}/tournaments/events/tournament_logo_' + _m_eventId + '.svg');
        _m_cp.SetDialogVariable('store-title', $.Localize('#major_hub_store_title_event', _m_cp));
    }
    function _SetBackgroundImages() {
        if (!_m_eventId)
            return;
        let bgImage = "url( 'file://{images}/tournaments/backgrounds/pickem_bg_" + _m_eventId + ".png')";
        if (_m_eventId !== 24) {
            _m_cp.FindChildInLayoutFile('id-graffiti-block').style.backgroundImage = bgImage;
            _m_cp.FindChildInLayoutFile('id-graffiti-block').SetHasClass('major-background-size', true);
            _m_cp.FindChildInLayoutFile('id-major-store-block').style.backgroundImage = bgImage;
            _m_cp.FindChildInLayoutFile('id-major-store-block').SetHasClass('major-background-size', true);
        }
        else {
            _m_cp.FindChildInLayoutFile('id-major-store').style.backgroundImage = bgImage;
            _m_cp.FindChildInLayoutFile('id-major-store').SetHasClass('major-background-size', true);
        }
        _m_cp.FindChildInLayoutFile('id-challenges-block').style.backgroundImage = bgImage;
        _m_cp.FindChildInLayoutFile('id-challenges-block').SetHasClass('major-background-size', true);
    }
    function _UpdateSouvenirSection(bItemsForSale) {
        let elDesc = _m_cp.FindChildInLayoutFile('id-major-hub-souvenir-desc');
        elDesc.visible = true;
        if (bItemsForSale) {
            let idForCharges = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_charge, 0);
            if (StoreAPI.GetStoreItemSalePrice(idForCharges, 1, '')) {
                _m_cp.SetDialogVariable('souvenir_price', StoreAPI.GetStoreItemSalePrice(idForCharges, 1, ''));
            }
            elDesc.SetDialogVariable('souvenir_package_desc', $.Localize('#major_hub_souvenir_package_desc', _m_cp));
        }
        else if (m_redeemAvailable && m_redeemAvailable > 0) {
            elDesc.SetDialogVariable('souvenir_package_desc', $.Localize('#major_hub_souvenir_package_desc_no_price', _m_cp));
        }
        else {
            elDesc.visible = false;
        }
        _m_cp.SetDialogVariable('souvenir_package', $.Localize('#CSGO_TournamentPass_' + g_ActiveTournamentInfo.location + '_store_desc'));
    }
    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    function _UpdateStoreBannar() {
        _m_cp.FindChildInLayoutFile('id-major-open-store').SetPanelEvent('onactivate', () => {
            UiToolkitAPI.ShowCustomLayoutPopup('id-popup-major-store', 'file://{resources}/layout/popups/popup_major_store.xml');
            $.DispatchEvent("CSGOPlaySoundEffect", "UIPanorama.tab_mainmenu_shop", "MOUSE");
        });
        const elStore = _m_cp.FindChildInLayoutFile('id-major-store-banner');
        const defidxStickerItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('sticker');
        const numStickers = 10;
        for (let i = 0; i < numStickers; i++) {
            const stickerIndex = (i == 4 || i == 5 || i == 8) ?
                g_ActiveTournamentTeams.filter(team => team.champions.length > 1)[0].champions[getRandomInt(0, 4)].stickerids[getRandomInt(0, 3)] :
                g_ActiveTournamentTeams[getRandomInt(0, g_ActiveTournamentTeams.length - 1)].players[getRandomInt(0, 4)].stickerids[getRandomInt(0, 3)];
            const itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, stickerIndex);
            let elDisplay;
            if (i == 2 || i == 8) {
                elDisplay = elStore.FindChildInLayoutFile('id-major-store-banner-item-' + i);
                elDisplay.SetCamera('camera_weapon_7');
                elDisplay.SetActiveItem(0);
                elDisplay.SetItemItemId(itemId, '');
                let nRenderInterval = 1;
                elDisplay.SetRenderInterval(nRenderInterval);
            }
            else {
                elDisplay = elStore.FindChildInLayoutFile('id-major-store-banner-item-' + i);
                elDisplay.itemid = itemId;
            }
            elDisplay.AddClass('show');
        }
        _SetUpBannerSouvenir(elStore);
    }
    function _SetUpBannerSouvenir(elStore) {
        InventoryAPI.SetInventorySortAndFilters('inv_sort_rarity', false, 'rifle,craft_souvenir,is_rental:false,is_sealed:false', '', '');
        let itemId = '';
        const count = InventoryAPI.GetInventoryCount();
        if (count > 0) {
            const rarityCutoff = Math.floor(InventoryAPI.GetItemRarity(InventoryAPI.GetInventoryItemIDByIndex(0)) / 3);
            let maxInclusiveIndex = count - 1;
            while (maxInclusiveIndex > 0) {
                const rarityMid = InventoryAPI.GetItemRarity(InventoryAPI.GetInventoryItemIDByIndex(maxInclusiveIndex));
                if (rarityMid >= rarityCutoff)
                    break;
                else
                    maxInclusiveIndex = Math.floor(maxInclusiveIndex / 2);
            }
            itemId = InventoryAPI.GetInventoryItemIDByIndex(getRandomInt(0, maxInclusiveIndex));
        }
        if (!itemId) {
            const randomRifles = [7, 8, 9, 10, 11, 13, 16, 40, 60];
            itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(randomRifles[getRandomInt(0, randomRifles.length - 1)], 0);
        }
        if (itemId) {
            const halfTeams = Math.floor(g_ActiveTournamentTeams.length / 2);
            const fauxSouvenirItemId = InventoryAPI.CreateTempCombinedItemWithTool(itemId, 'craft_souvenir:faux_' + g_ActiveTournamentInfo.eventid + '_'
                + g_ActiveTournamentTeams[getRandomInt(0, halfTeams - 1)].teamid + '_'
                + g_ActiveTournamentTeams[getRandomInt(halfTeams, g_ActiveTournamentTeams.length - 1)].teamid);
            if (fauxSouvenirItemId)
                itemId = fauxSouvenirItemId;
        }
        const defName = InventoryAPI.GetItemDefinitionName(itemId);
        let cameraData = XpShopWeaponCameraSettings.CameraSettings.find(({ type }) => type === defName);
        let cameraSuffix = cameraData !== undefined ? cameraData.camera : '0';
        const elModelPanel = elStore.FindChildInLayoutFile('id-major-store-banner-souvenir');
        elModelPanel.SetCamera('camera_weapon_' + cameraSuffix);
        elModelPanel.SetActiveItem(0);
        elModelPanel.SetItemItemId(itemId, '');
        let nRenderInterval = 1;
        elModelPanel.SetRenderInterval(nRenderInterval);
    }
    function _ItemsForSale() {
        var tournamentEventId = NewsAPI.GetActiveTournamentEventID();
        if (tournamentEventId === 0)
            return false;
        if (g_ActiveTournamentInfo.eventid !== tournamentEventId)
            return false;
        return g_ActiveTournamentInfo.active;
    }
    ;
    function _UpdateChallenges() {
        let tournamentCoinItemId = InventoryAPI.GetActiveTournamentCoinItemId(_m_eventId);
        let bHasActiveCoin = true;
        if (!tournamentCoinItemId || tournamentCoinItemId === '0') {
            bHasActiveCoin = false;
            tournamentCoinItemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_coins[0], 0);
        }
        let nCampaignID = InventoryAPI.GetItemAttributeValue(tournamentCoinItemId, "campaign id");
        let numTotalChallenges = InventoryAPI.GetCampaignNodeCount(nCampaignID);
        let nPointsEarned = 0;
        let arrMissions = [];
        for (let i = 0; i < numTotalChallenges; ++i) {
            let nMissionNodeID = InventoryAPI.GetCampaignNodeIDbyIndex(nCampaignID, i);
            let strNodeState = InventoryAPI.GetCampaignNodeState(nCampaignID, nMissionNodeID, tournamentCoinItemId, true);
            nPointsEarned = strNodeState === "complete" ? ++nPointsEarned : nPointsEarned;
            let nQuestID = InventoryAPI.GetCampaignNodeQuestID(nCampaignID, nMissionNodeID);
            ;
            let strFauxQuestItem = InventoryAPI.GetQuestItemIDFromQuestID(nQuestID);
            let strQuestIcon = InventoryAPI.GetQuestIcon(strFauxQuestItem);
            let strQuestName = InventoryAPI.GetItemName(strFauxQuestItem);
            let oChallenge = {
                idx: i,
                text: strQuestName,
                isComplete: strNodeState === "complete",
                isDisqualified: strNodeState === 'disqualified',
                icon: (!bHasActiveCoin || (strNodeState === 'disqualified')) ? 'locked' :
                    (strQuestIcon === 'watchem') ? 'watch' :
                        (strQuestIcon === 'pickem') ? 'trophy' :
                            strQuestIcon,
            };
            arrMissions.push(oChallenge);
        }
        let counter = 0;
        arrMissions.forEach(oChallenge => { if (oChallenge.isDisqualified) {
            oChallenge.idx = counter++;
            _CreateUpdateChallenge(oChallenge);
        } });
        arrMissions.forEach(oChallenge => { if (!oChallenge.isDisqualified) {
            oChallenge.idx = counter++;
            _CreateUpdateChallenge(oChallenge);
        } });
        _m_cp.SetHasClass('no-active-coin', !bHasActiveCoin);
        if (bHasActiveCoin) {
            _SetPoints(nPointsEarned, tournamentCoinItemId);
            _SetThresholdText(nPointsEarned, numTotalChallenges, tournamentCoinItemId);
            _RedemptionChargesRemaining(tournamentCoinItemId);
            _m_cp.FindChildInLayoutFile('id-major-hub-coin-model').SetActiveItem(0);
            _m_cp.FindChildInLayoutFile('id-major-hub-coin-model').SetItemItemId(tournamentCoinItemId, '');
            _m_cp.FindChildInLayoutFile('id-major-hub-coin-model').SetPanelEvent('onactivate', () => {
                $.DispatchEvent("InventoryItemPreview", tournamentCoinItemId, '');
            });
        }
        else {
            let passIndex = g_ActiveTournamentInfo.itemid_pass;
            let passId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(passIndex, 0);
            _m_cp.FindChildInLayoutFile('id-pass-upsell-image').itemid = passId;
            let coinIndex = g_ActiveTournamentInfo.itemid_coins[0];
            let coinId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(coinIndex, 0);
            _m_cp.FindChildInLayoutFile('id-pass-upsell-image-coin').itemid = coinId;
            _SetPassBtnAction();
        }
    }
    function _CreateUpdateChallenge(oChallenge) {
        var elList = _m_cp.FindChildInLayoutFile('id-major-challenges');
        var elChallenge = _m_cp.FindChildInLayoutFile('id-major-challenge-' + oChallenge.idx);
        if (!elChallenge) {
            elChallenge = $.CreatePanel("Panel", elList, 'id-major-challenge-' + oChallenge.idx);
            elChallenge.BLoadLayoutSnippet("major-challenge");
        }
        _UpdateChallenge(elChallenge, oChallenge);
    }
    function _UpdateChallenge(elChallenge, oChallenge) {
        let elIcon = elChallenge.FindChildInLayoutFile('id-major-challenge-icon');
        elChallenge.SetDialogVariable('challenge_desc', oChallenge.text);
        let iconPath = oChallenge.isComplete ? 'file://{images}/icons/ui/check.svg' :
            oChallenge.isDisqualified ? 'file://{images}/icons/ui/cancel.svg' :
                'file://{images}/icons/ui/' + oChallenge.icon + '.svg';
        elIcon.SetImage(iconPath);
        elChallenge.SetHasClass('complete', oChallenge.isComplete);
        elChallenge.SetHasClass('disqualified', !oChallenge.isComplete && oChallenge.isDisqualified);
    }
    function _SetPoints(nPointsEarned, tournamentCoinItemId) {
        _m_cp.SetDialogVariableInt('challenges_complete', nPointsEarned);
        let coinLevel = InventoryAPI.GetItemAttributeValue(tournamentCoinItemId, "upgrade level");
        let style = coinLevel < 1 ? 'bronze' : coinLevel === 1 ? 'silver' : coinLevel > 1 ? 'gold' : 'bronze';
        $.GetContextPanel().FindChildInLayoutFile('id-coin-status-image').AddClass(style);
    }
    var _SetThresholdText = function (nPointsEarned, nTotalChallenges, tournamentCoinItemId) {
        let threshold = InventoryAPI.GetItemAttributeValue(tournamentCoinItemId, "upgrade threshold");
        let sText = (nTotalChallenges - nPointsEarned) === 0 ? '#tournament_coin_completed_challenges' :
            (threshold > nPointsEarned) ? '#tournament_coin_remaining_challenges_curr' : '';
        let challengesRemain = threshold - nPointsEarned;
        _m_cp.SetDialogVariableInt('challenges', challengesRemain);
        _m_cp.SetDialogVariable('challenges_status', $.Localize(sText, $.GetContextPanel()));
    };
    var _RedemptionChargesRemaining = function (tournamentCoinItemId) {
        let coinLevel = parseInt(InventoryAPI.GetItemAttributeValue(tournamentCoinItemId, "upgrade level"));
        let coinRedeemsPurchased = parseInt(InventoryAPI.GetItemAttributeValue(tournamentCoinItemId, "operation drops awarded 1"));
        if (coinRedeemsPurchased)
            coinLevel += coinRedeemsPurchased;
        let redeemed = parseInt(InventoryAPI.GetItemAttributeValue(tournamentCoinItemId, "operation drops awarded 0"));
        m_redeemAvailable = coinLevel - redeemed;
        if (_m_eventId >= 26)
            m_redeemAvailable = 0;
        _m_cp.SetDialogVariableInt('redeems', m_redeemAvailable);
        let elPanel = _m_cp.FindChildInLayoutFile('id-coin-status-charges');
        elPanel.visible = m_redeemAvailable > 0;
        let sTooltip = $.Localize('#popup_redeem_souvenir_desc:f', _m_cp);
        elPanel.SetPanelEvent('onmouseover', () => { UiToolkitAPI.ShowTextTooltip('id-coin-status-charges', sTooltip); });
        elPanel.SetPanelEvent('onmouseout', () => { UiToolkitAPI.HideTextTooltip(); });
    };
    var _SetPassBtnAction = function () {
        let btn = _m_cp.FindChildInLayoutFile('id-pass-upsell-btn');
        let passItemId = InventoryAPI.GetActiveTournamentCoinItemId(_m_eventId * -1);
        if ((!passItemId || passItemId === '0')) {
            let bCanPurchasePass = (g_ActiveTournamentInfo.eventid === _m_eventId) &&
                ('' !== StoreAPI.GetStoreItemSalePrice(InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentStoreLayout[0][0], 0), 1, ''));
            if (bCanPurchasePass) {
                btn.text = '#SFUI_ConfirmBtn_GetPassNow';
                btn.SetPanelEvent('onactivate', () => {
                    var contextMenuPanel = UiToolkitAPI.ShowCustomLayoutContextMenuParameters('', '', 'file://{resources}/layout/context_menus/context_menu_store_linked_items.xml', 'itemids=' + InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pass, 0) +
                        ',' + InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pack, 0) +
                        '&' + 'linkedWarning=#tournament_items_notice');
                    contextMenuPanel.AddClass("ContextMenu_NoArrow");
                });
            }
            else {
                btn.text = '';
                btn.visible = false;
                btn.SetPanelEvent('onactivate', () => {
                });
            }
        }
        else {
            btn.text = '#SFUI_ConfirmBtn_ActivatePassNow';
            btn.SetPanelEvent('onactivate', () => {
                InventoryAPI.UseTool(passItemId, '');
            });
        }
    };
    function _SetUpSpray() {
        let elParent = $.GetContextPanel().FindChildInLayoutFile('id-major-store');
        if (!_m_eventId) {
            elParent.SetHasClass('graffiti-panel-visible', false);
            return;
        }
        let tournamentCoinItemId = InventoryAPI.GetActiveTournamentCoinItemId(_m_eventId);
        if (!tournamentCoinItemId || tournamentCoinItemId === '0' || g_ActiveTournamentInfo.eventid !== _m_eventId || !g_ActiveTournamentInfo.active) {
            elParent.SetHasClass('graffiti-panel-visible', false);
            return;
        }
        var elImage = $.GetContextPanel().FindChildInLayoutFile('id-tournament-journal-spray');
        elImage.itemid = ItemInfo.GetFauxReplacementItemID(tournamentCoinItemId, 'graffiti');
        var elIBtn = $.GetContextPanel().FindChildInLayoutFile('id-tournament-journal-selectspray-btn');
        elIBtn.SetPanelEvent('onactivate', function () {
            UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_tournament_select_spray.xml', 'journalid=' + tournamentCoinItemId +
                '&' + 'eventid=' + _m_eventId);
        });
        elParent.SetHasClass('graffiti-panel-visible', true);
    }
    ;
    function NavigateToTab(sectionIndex) {
        let elPage = _m_elPickemPages.FindChild('id-pickem-page-stage' + sectionIndex);
        elPage?.SetHasClass('hidden', m_selectedPage === elPage);
        m_selectedPage?.SetHasClass('hidden', m_selectedPage !== elPage);
        let sectionId = PredictionsAPI.GetEventSectionIDByIndex(_m_tournamentId, sectionIndex);
        let groupId = PredictionsAPI.GetSectionGroupIDByIndex(_m_tournamentId, sectionId, 0);
        m_selectedPage = elPage;
        m_oPageData.panel = elPage;
        m_oPageData.eventId = _m_eventId;
        m_oPageData.tournamentId = _m_tournamentId;
        m_oPageData.sectionId = sectionId;
        m_oPageData.groupId = groupId;
        m_oPageData.sectionIndex = sectionIndex;
        PredictionsTimer.UpdateTimer();
        if ((sectionIndex < g_ActiveTournamentInfo.num_stages_with_swiss) && elPage) {
            PredictionsGroup.Init();
        }
        else {
            PredictionsBracket.Init();
        }
        if (!m_oPageData.hasAlreadyInit.includes(elPage.id)) {
            m_oPageData.hasAlreadyInit.push(elPage.id);
        }
    }
    PopupMajorHub.NavigateToTab = NavigateToTab;
    function GetActivePageData() {
        return m_oPageData;
    }
    PopupMajorHub.GetActivePageData = GetActivePageData;
    function RefreshData() {
        MatchListAPI.Refresh(_m_tournamentId);
    }
    PopupMajorHub.RefreshData = RefreshData;
    function LoadPickEmData() {
        let listState = MatchListAPI.GetState(_m_tournamentId);
        let elLoadingPanel = _m_cp.FindChildInLayoutFile('id-pickem-loading-status');
        if (listState === 'none') {
            MatchListAPI.Refresh(_m_tournamentId);
            _CancelMatchStatsLoadedTimeout();
            _m_cp.SetHasClass('loading', true);
            _m_cp.SetHasClass('timeout', false);
            elLoadingPanel.SetDialogVariable('pickem_loaded_status', $.Localize('#CSGO_Watch_Loading_PickEm'));
        }
        if (listState === 'ready') {
            let isLoaded = PredictionsAPI.GetMyPredictionsLoaded(_m_tournamentId);
            let sectionsCount = PredictionsAPI.GetEventSectionsCount(_m_tournamentId);
            if (!isLoaded || !sectionsCount) {
                _CancelMatchStatsLoadedTimeout();
                _m_timeoutHandle = $.Schedule(5, () => {
                    _m_timeoutHandle = null;
                    elLoadingPanel.SetDialogVariable('pickem_loaded_status', $.Localize('#pickem_apply_timeout'));
                    _m_cp.SetHasClass('timeout', true);
                });
                return;
            }
            _CancelMatchStatsLoadedTimeout();
            _m_cp.SetHasClass('loading', false);
            if (!m_setDefaultTab) {
                $.Schedule(.15, SetDefaultTab);
            }
            else {
                NavigateToTab(m_oPageData.sectionIndex);
            }
            return;
        }
        return;
    }
    function _CancelMatchStatsLoadedTimeout() {
        if (_m_timeoutHandle) {
            $.CancelScheduled(_m_timeoutHandle);
            _m_timeoutHandle = null;
        }
    }
    ;
    function CheckIfPickIsCorrect(sCorrectPicks, userPickTeamID) {
        let aCorrectPicks = sCorrectPicks.split(',');
        return aCorrectPicks.includes(userPickTeamID.toString());
    }
    PopupMajorHub.CheckIfPickIsCorrect = CheckIfPickIsCorrect;
    function IsSectionActive() {
        if (PredictionsAPI.GetSectionIsActive(m_oPageData.tournamentId, m_oPageData.sectionId)) {
            return true;
        }
        return false;
    }
    PopupMajorHub.IsSectionActive = IsSectionActive;
    function IsPreviousSectionActive() {
        if (PredictionsAPI.GetSectionIsActive(m_oPageData.tournamentId, m_oPageData.sectionId - 1)) {
            return true;
        }
        return false;
    }
    PopupMajorHub.IsPreviousSectionActive = IsPreviousSectionActive;
    function GetTeamIcon(teamId) {
        let teamTag = PredictionsAPI.GetTeamTag(teamId);
        return 'file://{images}/tournaments/teams/' + teamTag + '.svg';
    }
    PopupMajorHub.GetTeamIcon = GetTeamIcon;
    function OnInventoryUpdated() {
        _SetUpSpray();
        _UpdateChallenges();
        SavePicksButton.ShowHideNoActivePassWarning(m_oPageData, false);
    }
    function RefreshActivePage() {
        PredictionsTimer.UpdateTimer();
        if (m_oPageData.sectionIndex < g_ActiveTournamentInfo.num_stages_with_swiss) {
            PredictionsGroup.UpdateFromPredictionUploadedEvent();
        }
        else if (m_oPageData.sectionIndex == g_ActiveTournamentInfo.num_stages_with_swiss) {
            PredictionsBracket.UpdateFromPredictionUploadedEvent();
        }
    }
    function ItemAcquired(itemId) {
        let nSouvenir = g_ActiveTournamentInfo;
        let newItemDefName = InventoryAPI.GetItemDefinitionName(itemId);
        let passDef = InventoryAPI.GetItemDefinitionName(InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pass, 0));
        let passPackDef = InventoryAPI.GetItemDefinitionName(InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pack, 0));
        if (InventoryAPI.GetItemDefinitionName(itemId) === passDef || InventoryAPI.GetItemDefinitionName(itemId) === passPackDef) {
            AcknowledgeItems.GetItemsByType([passDef, passPackDef], true);
            OpenPassActivate(itemId);
            return;
        }
    }
    function OpenPassActivate(itemId) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_capability_decodable.xml');
        let oSettings = {
            item_id: itemId,
            work_type: 'decodeable'
        };
        elPanel.Data().oSettings = oSettings;
    }
    function DeleteDragItem() {
        if (PopupMajorHub.m_elDragImage && PopupMajorHub.m_elDragImage.IsValid()) {
            PopupMajorHub.m_elDragImage.DeleteAsync(0.25);
        }
    }
    PopupMajorHub.DeleteDragItem = DeleteDragItem;
    {
        ReadyForDisplay();
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_GcLogonNotificationReceived', ReadyForDisplay);
        $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_UpdateConnectionToGC', ReadyForDisplay);
        $.RegisterForUnhandledEvent('PanoramaComponent_MatchList_StateChange', LoadPickEmData);
        $.RegisterForUnhandledEvent('PanoramaComponent_MatchList_PredictionUploaded', RefreshActivePage);
        $.RegisterForUnhandledEvent('PanoramaComponent_Store_PurchaseCompleted', ItemAcquired);
        $.RegisterForUnhandledEvent('OpenInventory', ClosePopup);
        $.RegisterEventHandler('ReadyForDisplay', _m_cp, ReadyForDisplay);
        $.RegisterEventHandler('UnreadyForDisplay', _m_cp, UnreadyForDisplay);
    }
})(PopupMajorHub || (PopupMajorHub = {}));
var SavePicksButton;
(function (SavePicksButton) {
    let _m_timeoutApplyHandle;
    function UpdateBtn(aLocalPicks = []) {
        ResetTimeoutHandle();
        let oPageData = PopupMajorHub.GetActivePageData();
        let elBtn = oPageData.panel.FindChildInLayoutFile('id-predictions-apply-btn').FindChild('id-apply-btn');
        let elWarning = oPageData.panel.FindChildInLayoutFile('id-predictions-apply-btn').FindChild('id-apply-warning');
        elWarning.SetDialogVariable('pass-name', InventoryAPI.GetItemName(InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pass, 0)));
        let bThisSectionIsNoLongerActive = !PredictionsAPI.GetSectionIsActive(oPageData.tournamentId, oPageData.sectionId);
        if (!PredictionsAPI.GetGroupCanPick(oPageData.tournamentId, oPageData.groupId)) {
            elBtn.enabled = false;
            elBtn.visible = false;
            ShowHideNoActivePassWarning(oPageData, true);
            let elToggleBtn = oPageData.panel.FindChildInLayoutFile('id-predictions-apply-btn').FindChild('id-toggle-correct-btn');
            elToggleBtn.visible = true;
            elToggleBtn.SetPanelEvent('onactivate', () => {
                oPageData.panel.SetHasClass('show-all-correct-picks', !oPageData.panel.BHasClass('show-all-correct-picks'));
            });
            elToggleBtn.checked = bThisSectionIsNoLongerActive;
            oPageData.panel.SetHasClass('show-all-correct-picks', bThisSectionIsNoLongerActive);
            return;
        }
        if (bThisSectionIsNoLongerActive) {
            elBtn.enabled = false;
            elBtn.visible = false;
            ShowHideNoActivePassWarning(oPageData, true);
            return;
        }
        elBtn.visible = true;
        ShowHideNoActivePassWarning(oPageData, false);
        let nCount = (oPageData.sectionIndex >= g_ActiveTournamentInfo.num_stages_with_swiss) ? 7 : PredictionsAPI.GetGroupPicksCount(oPageData.tournamentId, oPageData.groupId);
        if (aLocalPicks.length === nCount) {
            let bPicksDifferent = false;
            for (let i = 0; i < nCount; ++i) {
                if (aLocalPicks[i].teamId !== PredictionsAPI.GetMyPredictionTeamID(oPageData.tournamentId, aLocalPicks[i].group, aLocalPicks[i].groupIndex)) {
                    bPicksDifferent = true;
                    break;
                }
                ;
            }
            elBtn.enabled = bPicksDifferent;
            elBtn.SetDialogVariable('save-btn-text', bPicksDifferent ?
                $.Localize('#pickem_save_all') :
                $.Localize('#pickem_saved'));
            elBtn.SwitchClass('btn_state', !bPicksDifferent ? 'saved' : '');
            if (bPicksDifferent) {
                _SetPicks(elBtn, oPageData, nCount, aLocalPicks);
            }
        }
        else {
            elBtn.enabled = false;
            elBtn.SwitchClass('btn_state', '');
            elBtn.SetDialogVariableInt('user-picks', aLocalPicks.length);
            elBtn.SetDialogVariableInt('total-picks', nCount);
            elBtn.SetDialogVariable('save-btn-text', $.Localize('#pickem_make_picks', elBtn));
        }
    }
    SavePicksButton.UpdateBtn = UpdateBtn;
    function ShowHideNoActivePassWarning(oPageData, bHide = false) {
        if (!oPageData.panel || oPageData.panel.IsValid() === false) {
            return;
        }
        let elWarning = oPageData.panel.FindChildInLayoutFile('id-predictions-apply-btn').FindChild('id-apply-warning');
        let tournamentCoinItemId = InventoryAPI.GetActiveTournamentCoinItemId(SavePicksButton._m_eventId);
        elWarning.visible = (!tournamentCoinItemId || tournamentCoinItemId === '0') && !bHide;
    }
    SavePicksButton.ShowHideNoActivePassWarning = ShowHideNoActivePassWarning;
    function _SetPicks(elBtn, oPageData, nCount, aLocalPicks) {
        if (elBtn.enabled) {
            var args = [oPageData.tournamentId];
            for (var i = 0; i < nCount; ++i) {
                args.push(aLocalPicks[i].group.toString(), aLocalPicks[i].groupIndex.toString(), PredictionsAPI.GetFakeItemIDToRepresentTeamID(oPageData.tournamentId, aLocalPicks[i].teamId));
            }
            elBtn.SetPanelEvent('onactivate', () => {
                let tournamentCoinItemId = InventoryAPI.GetActiveTournamentCoinItemId(oPageData.eventId);
                let passItemId = InventoryAPI.GetActiveTournamentCoinItemId(SavePicksButton._m_eventId * -1);
                let bHasActiveCoin = tournamentCoinItemId && tournamentCoinItemId !== '0';
                let bIsPrime = (MyPersonaAPI.GetElevatedState() === 'elevated');
                if (!elBtn.BHasClass('activated-by-program')) {
                    if (!bIsPrime && !bHasActiveCoin) {
                        if (!elBtn.BHasClass('activated-by-program')) {
                            UiToolkitAPI.ShowGenericPopupTwoOptions('#CSGO_official_leaderboard_pickem_' + g_ActiveTournamentInfo.location + '_team', '#CSGO_PickEm_Leaderboards_PassOrPrime_Message', '', '#SFUI_ConfirmBtn_GetPassNow', () => { }, '#SFUI_Elevated_Status_Sale_action', () => { UiToolkitAPI.ShowCustomLayoutPopup('prime_status', 'file://{resources}/layout/popups/popup_prime_status.xml'); });
                        }
                        return;
                    }
                    if (!bHasActiveCoin && (passItemId && passItemId !== '0')) {
                        let elPopup = UiToolkitAPI.ShowGenericPopupTwoOptions('#pickem_submit_warning_popup_title', '#pickem_submit_warning_popup_desc', '', '#pickem_submit_warning_popup_action2', () => {
                            InventoryAPI.UseTool(passItemId, '');
                            _SubmitPicks(elBtn, args);
                        }, '#pickem_submit_warning_popup_action', () => { _SubmitPicks(elBtn, args); });
                        elPopup.SetDialogVariable('pass-name', InventoryAPI.GetItemName(InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pass, 0)));
                        return;
                    }
                    if (!bHasActiveCoin) {
                        let elPopup = UiToolkitAPI.ShowGenericPopupTwoOptions('#pickem_submit_warning_popup_title', '#pickem_submit_warning_popup_desc', '', '#SFUI_ConfirmBtn_GetPassNow', () => {
                            $.DispatchEvent('UIPopupButtonClicked', elPopup, '');
                            $.DispatchEvent('ContextMenuEvent', '');
                            UiToolkitAPI.HideTextTooltip();
                            var contextMenuPanel = UiToolkitAPI.ShowCustomLayoutContextMenuParameters('', '', 'file://{resources}/layout/context_menus/context_menu_store_linked_items.xml', 'itemids=' + InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pass, 0) +
                                ',' + InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pack, 0) +
                                '&' + 'linkedWarning=#tournament_items_notice');
                            contextMenuPanel.AddClass("ContextMenu_NoArrow");
                            contextMenuPanel.SetFocus();
                        }, '#pickem_submit_warning_popup_action', () => { _SubmitPicks(elBtn, args); });
                        elPopup.SetDialogVariable('pass-name', InventoryAPI.GetItemName(InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(g_ActiveTournamentInfo.itemid_pass, 0)));
                        return;
                    }
                }
                _SubmitPicks(elBtn, args);
            });
        }
    }
    function _SubmitPicks(elBtn, args) {
        elBtn.enabled = false;
        elBtn.SwitchClass('btn_state', 'waiting-for-update');
        $.DispatchEvent('CSGOPlaySoundEffect', 'UIPanorama.tab_mainmenu_shop', 'MOUSE');
        PredictionsAPI.SetMyPredictionUsingItemID.apply(PredictionsAPI, args);
        ResetTimeoutHandle();
        _m_timeoutApplyHandle = $.Schedule(7, () => {
            _CancelWaitForCallBack(elBtn);
        });
    }
    SavePicksButton._SubmitPicks = _SubmitPicks;
    function ResetTimeoutHandle() {
        if (_m_timeoutApplyHandle) {
            $.CancelScheduled(_m_timeoutApplyHandle);
            _m_timeoutApplyHandle = null;
        }
    }
    SavePicksButton.ResetTimeoutHandle = ResetTimeoutHandle;
    function _CancelWaitForCallBack(elBtn) {
        _m_timeoutApplyHandle = null;
        PopupMajorHub.ClosePopup();
        UiToolkitAPI.ShowGenericPopupOk($.Localize('#SFUI_SteamConnectionErrorTitle'), $.Localize('#CSGO_PickEm_Pick_TimeOut'), '', () => { });
    }
})(SavePicksButton || (SavePicksButton = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfbWFqb3JfaHViLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vY29udGVudC9jc2dvL3Bhbm9yYW1hL3NjcmlwdHMvcG9wdXBzL3BvcHVwX21ham9yX2h1Yi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQ0EscUNBQXFDO0FBQ3JDLGlEQUFpRDtBQUNqRCwrQ0FBK0M7QUFDL0MsaURBQWlEO0FBQ2pELDhFQUE4RTtBQUM5RSw0RUFBNEU7QUFDNUUsd0VBQXdFO0FBQ3hFLDREQUE0RDtBQUM1RCw2Q0FBNkM7QUFDN0MsNERBQTREO0FBQzVELGtFQUFrRTtBQUNsRSxvRUFBb0U7QUFFcEUsSUFBVSxhQUFhLENBbTVCdEI7QUFuNUJELFdBQVUsYUFBYTtJQUV0QixNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7SUFDL0IsTUFBTSxnQkFBZ0IsR0FBWSxLQUFLLENBQUMscUJBQXFCLENBQUUsaUJBQWlCLENBQUUsQ0FBQztJQUNuRixJQUFJLGdCQUErQixDQUFDO0lBQ3BDLElBQUksVUFBa0IsQ0FBQztJQUN2QixJQUFJLGVBQXVCLENBQUM7SUFDNUIsSUFBSSwwQkFBeUMsQ0FBQztJQUM5QyxJQUFJLGNBQThCLENBQUM7SUFDbkMsSUFBSSxlQUF5QixDQUFDO0lBQzlCLElBQUksaUJBQWlCLEdBQVcsQ0FBQyxDQUFDO0lBMkJsQyxJQUFJLFdBQVcsR0FBRyxFQUFnQixDQUFDO0lBQ25DLFdBQVcsQ0FBQyxjQUFjLEdBQUcsRUFBRSxDQUFDO0lBRWhDLFNBQWdCLFVBQVU7UUFFdEIsSUFBSSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxnQkFBZ0IsRUFDbEQ7WUFDSSxXQUFXLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBRSxFQUFFLENBQUMsRUFBRTtnQkFDckMsSUFBSSxNQUFNLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxJQUFLLE1BQU0s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