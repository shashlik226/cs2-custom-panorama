"use strict";
/// <reference path="../csgo.d.ts" />
/// <reference path="../common/hold_button.ts" />
/// <reference path="../common/iteminfo.ts" />
/// <reference path="../inspect.ts" />
/// <reference path="popup_inspect_shared.ts" />
/// <reference path="popup_can_apply_pick_slot.ts" />
/// <reference path="../generated/items_event_current_generated_store.ts" />
/// <reference path="../common/shopping_cart.ts" />
var InspectAsyncActionBar;
(function (InspectAsyncActionBar) {
    let m_scheduleHandle = null;
    function Init() {
        const worktype = InspectShared.GetPopupSetting('work_type');
        const toolId = InspectShared.GetPopupSetting('tool_id');
        const showXrayMachineUi = InspectShared.GetPopupSetting('is_xray_machine');
        const allowRental = InspectShared.GetPopupSetting('allow_rent');
        const elAsyncActionBarPanel = $.GetContextPanel().FindChildInLayoutFile('PopUpInspectAsyncBar');
        $.GetContextPanel().AddClass('PopupPanelCapability_' + worktype);
        if (InspectShared.GetPopupSetting('force_hide_async_bar') ||
            !worktype ||
            (allowRental && !showXrayMachineUi) ||
            (worktype === 'nameable' && !toolId) ||
            _DoesNotMeetDecodalbeRequirements()) {
            elAsyncActionBarPanel.AddClass('hidden');
            return;
        }
        elAsyncActionBarPanel.RemoveClass('hidden');
        _SetUpDescription(elAsyncActionBarPanel);
        _SetUpButtonStates(elAsyncActionBarPanel);
        elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn').checked = true;
        _ShowHideInspectViewButtons(elAsyncActionBarPanel);
        _ChangeSceneryBtn(elAsyncActionBarPanel);
        _ShowZoomBtn(elAsyncActionBarPanel);
        elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkCancelBtn').SetPanelEvent('onactivate', () => {
            if (_DefaultZoomView(worktype, elAsyncActionBarPanel) === false)
                _ClosePopup();
        });
        if (worktype === 'prestigecheck') {
            _OnAccept($.GetContextPanel().Data().oSettings, elAsyncActionBarPanel);
        }
        const cp = $.GetContextPanel();
        if (!elAsyncActionBarPanel.Data().PanelRegisteredForEvents) {
            elAsyncActionBarPanel.Data().PanelRegisteredForEvents = $.RegisterForUnhandledEvent('PanoramaComponent_Inventory_ItemCustomizationNotification', (...args) => {
                return _OnItemCustomization(...args, cp);
            });
            if (worktype !== 'decodeable' && worktype !== 'nameable' && worktype !== 'remove_sticker') {
                $.RegisterForUnhandledEvent('PanoramaComponent_MyPersona_InventoryUpdated', _OnMyPersonaInventoryUpdated);
                $.RegisterForUnhandledEvent('PanoramaComponent_Inventory_PrestigeCoinResponse', _OnInventoryPrestigeCoinResponse);
            }
            if (worktype === 'craft_souvenir') {
                $.RegisterForUnhandledEvent('PanoramaComponent_Store_VolatileShopSubscribe', (...args) => { _OnVolatileShopSubscribe(...args, cp); });
                _EnsureVolatileShopSubscribed(cp);
            }
        }
    }
    InspectAsyncActionBar.Init = Init;
    function _EnsureVolatileShopSubscribed(cp) {
        if (!cp || !cp.IsValid())
            return;
        if (cp.Data().refreshSubscriptionHandle) {
            $.CancelScheduled(cp.Data().refreshSubscriptionHandle);
            cp.Data().refreshSubscriptionHandle = null;
        }
        StoreAPI.VolatileShopSubscribe(g_ActiveTournamentInfo.itemid_dynamic_stickers);
        cp.Data().refreshSubscriptionHandle = $.Schedule(150, () => _EnsureVolatileShopSubscribed(cp));
    }
    function _DoesNotMeetDecodalbeRequirements() {
        if (InspectShared.GetPopupSetting('work_type') === 'decodeable') {
            const sRestriction = InventoryAPI.GetDecodeableRestriction(InspectShared.GetPopupSetting('item_id'));
            const showXrayMachineUi = InspectShared.GetPopupSetting('is_xray_machine');
            if (sRestriction === 'restricted' || (sRestriction === 'xray' && !showXrayMachineUi) || InspectShared.GetPopupSetting('inspect_only'))
                return false;
            return (!InspectShared.GetPopupSetting('tool_id') && !InspectShared.GetPopupSetting('is_keyless'));
        }
        return false;
    }
    function _PerformAsyncAction(oSettings, bForceRemoveSticker = false) {
        const worktype = oSettings.work_type;
        const itemId = oSettings.item_id;
        const toolId = oSettings.tool_id;
        const bAllowXray = oSettings.allow_xray_claim;
        const selectedSlot = parseInt($.GetContextPanel().GetAttributeString('selectedItemToApplySlot', ''));
        if (worktype === 'useitem' || worktype === 'usegift') {
            InventoryAPI.UseTool(itemId, '');
        }
        else if (worktype === 'delete') {
            InventoryAPI.DeleteItem(itemId);
        }
        else if (worktype === 'prestigecheck') {
            InventoryAPI.RequestPrestigeCoinCheck();
        }
        else if (worktype === 'prestigeget' || worktype === 'prestigeupgrade') {
            InventoryAPI.RequestPrestigeCoin(InventoryAPI.GetItemDefinitionIndex(itemId));
        }
        else if (worktype === 'nameable') {
            $.DispatchEvent("CSGOPlaySoundEffect", "rename_applyConfirm", "MOUSE");
            InventoryAPI.UseTool(toolId, itemId);
            if ($.GetContextPanel().FindChildInLayoutFile('NameableRemoveConfirm')) {
                $.GetContextPanel().FindChildInLayoutFile('NameableRemoveConfirm').enabled = false;
                $.GetContextPanel().FindChildInLayoutFile('NameableValidBtn').enabled = false;
            }
        }
        else if (worktype === 'remove_patch') {
            $.DispatchEvent('CSGOPlaySoundEffect', 'UI.StickerScratch', 'MOUSE');
            InventoryAPI.WearItemSticker(itemId, selectedSlot, 0);
        }
        else if (worktype === 'remove_keychain') {
            $.DispatchEvent('CSGOPlaySoundEffect', 'UI.StickerScratch', 'MOUSE');
            InventoryAPI.RemoveKeychain(itemId, 0);
        }
        else if (worktype === 'remove_sticker') {
            if (oSettings.remove_sticker_all_at_once) {
                $.DispatchEvent('CSGOPlaySoundEffect', 'UI.StickerScratch', 'MOUSE');
                _ClosePopup();
                const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + itemId, 'file://{resources}/layout/popups/popup_capability_can_keychain.xml');
                let oSouvenirSettings = {
                    item_id: itemId,
                    tool_id: '',
                    umid_souvenir: oSettings.umid_souvenir,
                    work_type: 'craft_souvenir'
                };
                elPanel.Data().oSettings = oSouvenirSettings;
                return;
            }
            CapabilityCanSticker.OnScratchSticker(itemId, selectedSlot, bForceRemoveSticker, oSettings.popup_panel);
        }
        else if (worktype === 'can_wrap_sticker' && !oSettings.tool_id) {
            $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applyConfirm', 'MOUSE');
            InventoryAPI.RemoveKeychain(itemId, 0);
        }
        else if (worktype === 'can_sticker' || worktype === 'can_patch' || worktype === 'can_keychain' || worktype === 'can_wrap_sticker') {
            $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applyConfirm', 'MOUSE');
            InventoryAPI.SetStickerToolSlot(itemId, selectedSlot);
            InventoryAPI.UseTool(toolId, itemId);
        }
        else if (worktype === 'craft_souvenir') {
            const fauxCartItemID = oSettings.temp_display_item_id;
            const nPurchaseCost = _ComputeTotalSouvenirCost(oSettings.popup_panel, fauxCartItemID);
            const strPurchaseCommand = 'craft_souvenir:' + itemId + ':' + oSettings.umid_souvenir;
            m_SouvenirCheckoutCart = ShoppingCart.findOrCreateTempCart(itemId, true);
            const shopItem = {
                id: fauxCartItemID,
                name: ItemInfo.GetFormattedName(fauxCartItemID),
                price: nPurchaseCost,
                checkout_id: strPurchaseCommand
            };
            m_SouvenirCheckoutCart.clearCart();
            m_SouvenirCheckoutCart.addItem(shopItem);
            $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applyConfirm', 'MOUSE');
            const popupPanel = UiToolkitAPI.ShowCustomLayoutPopupParameters('id-popup-shopping-cart-checkout', 'file://{resources}/layout/popups/popup_shopping_cart_checkout.xml', 'cartid=' + itemId +
                '&checkoutsuffix=_souvenir');
            popupPanel.Data().eventId = g_ActiveTournamentInfo.eventid;
        }
        else if (worktype === 'decodeable') {
            if (ItemInfo.IsSpraySealed(itemId) || ItemInfo.ItemDefinitionNameSubstrMatch(itemId, 'tournament_pass_')) {
                InventoryAPI.UseTool(itemId, '');
            }
            else if (InventoryAPI.GetDecodeableRestriction(itemId) === "xray" && !bAllowXray) {
                InventoryAPI.UseTool(itemId, itemId);
            }
            else if (InventoryAPI.GetItemAttributeValue(itemId, '{uint32}volatile container')) {
                $.DispatchEvent('CSGOPlaySoundEffect', 'UI.Laptop.Unlock', 'MOUSE');
                InventoryAPI.UseTool(toolId, itemId);
            }
            else {
                InventoryAPI.UseTool(toolId, itemId);
            }
            if (InventoryAPI.GetDecodeableRestriction(itemId) !== "xray") {
                $.DispatchEvent('StartDecodeableAnim');
            }
        }
    }
    function _SetUpButtonStates(elPanel) {
        const elOK = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm');
        const elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
        const worktype = InspectShared.GetPopupSetting('work_type');
        const itemId = InspectShared.GetPopupSetting('item_id');
        let sOkButtonText = '#popup_' + worktype + '_button';
        if (InspectShared.GetPopupSetting('is_workshop_preview')) {
            elOK.AddClass('hidden');
            if (elNegative)
                elNegative.AddClass('hidden');
        }
        const oSettings = $.GetContextPanel().Data().oSettings;
        function _SetPanelEventOnAccept() {
            elOK.SetPanelEvent('onactivate', () => _OnAccept(oSettings, elPanel));
        }
        if (worktype === '') {
            return;
        }
        if (worktype === 'can_wrap_sticker') {
            elOK.visible = false;
            elNegative.visible = false;
            const toolId = InspectShared.GetPopupSetting('tool_id');
            ;
            const btnId = toolId ? 'AsyncItemWorkAcceptConfirmHold' : 'AsyncItemWorkAcceptNegativeHold';
            const btnHoldAction = elPanel.FindChildInLayoutFile(btnId);
            const locString = !toolId ? '#popup_' + worktype + '_button_negative' : '#popup_' + worktype + '_button';
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: !toolId ? '#popup_' + worktype + '_button_negative_tooltip' : '#popup_' + worktype + '_button_tooltip',
                locString: locString,
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
            return;
        }
        if (worktype === 'craft_souvenir') {
            elOK.visible = false;
            elNegative.visible = false;
            const btnId = 'AsyncItemWorkAcceptConfirmHold';
            const btnHoldAction = elPanel.FindChildInLayoutFile(btnId);
            let locString = '#popup_' + worktype + '_button';
            const nTotalCostInCredits = _ComputeTotalSouvenirCost(oSettings.popup_panel);
            const umidSouvenir = InspectShared.GetPopupSetting('umid_souvenir');
            if (nTotalCostInCredits) {
                btnHoldAction.SetDialogVariableInt('cost_souvenir', nTotalCostInCredits);
                m_panelsToSetCost = [btnHoldAction];
                locString += '_spend';
                locString = $.Localize(locString, btnHoldAction);
            }
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: '#popup_' + worktype + '_button_tooltip',
                locString: locString,
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel);
                }
            };
            HoldButton.SetupButton(btnSettings);
            btnHoldAction.enabled = true;
            const elButtonChangeSouvenirItem = elPanel.FindChildInLayoutFile('ChangeSouvenirItem');
            elButtonChangeSouvenirItem.RemoveClass('hidden');
            elButtonChangeSouvenirItem.SetPanelEvent('onactivate', () => {
                $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applySticker', 'MOUSE');
                _ClosePopup();
                $.DispatchEvent('ShowSelectItemForCapabilityPopup', umidSouvenir, '', 'craft_souvenir');
            });
            elPanel.FindChildInLayoutFile('MakeSouvenirPlayerSelectIcon').RemoveClass('hidden');
            const elMakeSouvenirPlayerSelect = elPanel.FindChildInLayoutFile('MakeSouvenirPlayerSelect');
            elMakeSouvenirPlayerSelect.RemoveClass('hidden');
            const goldenItemId = InspectShared.GetPopupSetting('temp_display_item_id');
            const unTeamIDs = [InventoryAPI.GetItemAttributeValue(goldenItemId, '{uint32}tournament event team0 id'),
                InventoryAPI.GetItemAttributeValue(goldenItemId, '{uint32}tournament event team1 id')];
            const unPlayerID = InventoryAPI.GetItemAttributeValue(goldenItemId, '{uint32}tournament mvp account id');
            let arrSelections = [];
            const defidxStickerItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('sticker');
            g_ActiveTournamentTeams.filter((tt) => unTeamIDs.includes(tt.teamid)).forEach((tt) => {
                tt.players.forEach((tp) => {
                    let sPlayerName = $.Localize('#SFUI_ProPlayer_' + tp.code, elPanel).split(" ");
                    sPlayerName.splice(1, 0, ...["'" + tp.nick + "'"]);
                    const idFauxSticker = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, tp.stickerids[tp.stickerids.length - 1]);
                    let unCostInCredits = MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, idFauxSticker);
                    arrSelections.push({
                        unPlayerID: tp.playerid,
                        sPlayerName: sPlayerName.join(" "),
                        sTeamTag: tt.team,
                        unCostInCredits: unCostInCredits,
                        unStickerID: tp.stickerids[tp.stickerids.length - 1]
                    });
                });
            });
            arrSelections.sort((a, b) => (a.unCostInCredits - b.unCostInCredits) * 100000 + (a.unStickerID - b.unStickerID));
            arrSelections.forEach((sel) => {
                let elOption = $.CreatePanel('Panel', elMakeSouvenirPlayerSelect, 'id-MakeSouvenirPlayerSelect-p' + sel.unPlayerID);
                elOption.BLoadLayoutSnippet('craft-souvenir-dropdown-select-player-entry');
                let elNamePanel = elOption.FindChildInLayoutFile('id-craft-souvenir-dropdown-select-player-entry-name');
                elNamePanel.text = sel.sPlayerName;
                elOption.FindChildInLayoutFile('id-craft-souvenir-dropdown-select-player-entry-cost')
                    .SetDialogVariableInt('cost', sel.unCostInCredits);
                elOption.FindChildInLayoutFile('id-team-player-logo')
                    .SetImage("file://{images}/tournaments/teams/" + sel.sTeamTag + ".svg");
                elOption.SetAttributeUInt32('playerid', sel.unPlayerID);
                if (sel.unPlayerID != unPlayerID) {
                    elNamePanel.SetPanelEvent('onactivate', () => {
                        $.DispatchEvent("Activated", elNamePanel.GetParent(), "mouse");
                    });
                }
                else {
                    elOption.AddClass('craft_souvenir_dropdown_selected');
                }
                elMakeSouvenirPlayerSelect.AddOption(elOption);
            });
            elMakeSouvenirPlayerSelect.SetPanelEvent('oninputsubmit', () => {
                const elSelected = elMakeSouvenirPlayerSelect.GetSelected();
                const nNewPlayerID = elSelected.GetAttributeUInt32('playerid', 0);
                if (nNewPlayerID && unPlayerID != nNewPlayerID) {
                    let oNewSettings = {
                        item_id: itemId,
                        tool_id: '',
                        umid_souvenir: 'pid_' + nNewPlayerID + ':' + (umidSouvenir.split(':').pop()),
                        work_type: 'craft_souvenir'
                    };
                    _ClosePopup();
                    const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + itemId, 'file://{resources}/layout/popups/popup_capability_can_keychain.xml');
                    elPanel.AddClass('PopupPanelCapability_' + oNewSettings.work_type);
                    elPanel.Data().oSettings = oNewSettings;
                }
            });
            elMakeSouvenirPlayerSelect.SetSelected('id-MakeSouvenirPlayerSelect-p' + unPlayerID);
            return;
        }
        if (worktype === 'remove_keychain') {
            elOK.visible = false;
            elNegative.visible = false;
            const btnHoldAction = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: '#SFUI_Keychain_Remove_Tooltip',
                locString: '#popup_' + worktype + '_button',
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
            return;
        }
        if (worktype === 'remove_patch') {
            elOK.visible = false;
            elNegative.visible = false;
            const btnHoldAction = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: '#SFUI_Patch_Remove_Desc_Tooltip',
                locString: '#popup_' + worktype + '_button',
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
            return;
        }
        if (worktype === 'remove_sticker') {
            const bRemovingAllStickersForSouvenir = !!InspectShared.GetPopupSetting('remove_sticker_all_at_once');
            if (bRemovingAllStickersForSouvenir)
                elOK.visible = false;
            elNegative.visible = false;
            const btnHoldAction = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: bRemovingAllStickersForSouvenir ? '#SFUI_Sticker_WipeStickersImmediate_Tooltip' : '#SFUI_Sticker_RemoveImmediate_Tooltip',
                locString: '#popup_' + worktype + '_button_negative' + (bRemovingAllStickersForSouvenir ? '_wipestickers' : ''),
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel, true);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
        }
        if (worktype === 'delete') {
            elNegative.visible = false;
            elOK.visible = false;
            const btnHoldAction = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            btnHoldAction.RemoveClass('AsyncItemWorkAcceptNegativeHidden');
            const btnSettings = {
                btn: btnHoldAction,
                tooltip: '#popup_delete_tooltip',
                locString: '#popup_' + worktype + '_button',
                loopingSound: 'UI.Laptop.ButtonFillLoop',
                timerCompleteAction: () => {
                    _OnAccept(oSettings, elPanel, true);
                    btnHoldAction.enabled = false;
                }
            };
            HoldButton.SetupButton(btnSettings);
            return;
        }
        const toolId = InspectShared.GetPopupSetting('tool_id');
        const itemDefName = InventoryAPI.GetItemDefinitionName(itemId);
        const btnStyle = InspectShared.GetPopupSetting('override_async_btn_style') === false ?
            'Positive' :
            InspectShared.GetPopupSetting('override_async_btn_style');
        if (worktype === 'decodeable') {
            const sRestriction = InventoryAPI.GetDecodeableRestriction(itemId);
            const elDescLabel = elPanel.FindChildInLayoutFile('AsyncItemWorkDesc');
            const elDescImage = elPanel.FindChildInLayoutFile('AsyncItemWorkDescImage');
            const inspectOnly = InspectShared.GetPopupSetting('inspect_only');
            if (inspectOnly || sRestriction === 'restricted') {
                elOK.visible = false;
                elDescLabel.visible = false;
                elDescImage.visible = false;
                return;
            }
            if (InspectShared.GetPopupSetting('is_xray_machine')) {
                const enabled = InspectShared.GetPopupSetting('allow_xray_claim') ? true : false;
                EnableDisableOkBtn(elPanel, enabled);
                elOK.AddClass(btnStyle);
                elOK.text = '#popup_xray_claim_item';
                _SetPanelEventOnAccept();
                return;
            }
            if (sRestriction === 'xray' && !inspectOnly) {
                elOK.visible = true;
                elOK.text = '#popup_xray_button_goto';
                elOK.AddClass(btnStyle);
                elOK.SetPanelEvent('onactivate', () => {
                    $.DispatchEvent("ShowXrayCasePopup", !toolId ? '' : toolId, itemId, true);
                    _ClosePopup();
                });
                elDescLabel.visible = true;
                elDescLabel.text = '#popup_decodeable_async_xray_desc';
                elDescImage.visible = false;
                return;
            }
            const terminalValue = InventoryAPI.GetItemAttributeValue(itemId, '{uint32}volatile container');
            const isTerminal = (terminalValue == '' || terminalValue == undefined || terminalValue == 0) ? false : true;
            if (itemDefName && itemDefName.indexOf("spray") != -1)
                sOkButtonText = sOkButtonText + "_graffiti";
            else if (itemDefName && itemDefName.indexOf("tournament_pass_") != -1)
                sOkButtonText = sOkButtonText + "_fantoken";
            else if (terminalValue)
                sOkButtonText = sOkButtonText + "_terminal";
            const elDropdown = elPanel.FindChildInLayoutFile('AsyncOfferLimitDropdown');
            elDropdown.SetHasClass('hidden', !isTerminal);
            if (isTerminal)
                _SetUpOfferLimitDropdown(elDropdown);
        }
        if (worktype === 'can_sticker') {
            const listStickers = ItemInfo.GetitemStickerList(itemId);
            elOK.SetDialogVariableInt('sticker_count', listStickers.length + 1);
            elOK.SetDialogVariableInt('max_stickers', 5);
        }
        if (worktype === 'nameable' && itemDefName === 'casket') {
            sOkButtonText = '#popup_newcasket_button';
        }
        if (worktype === 'useitem') {
            if (itemDefName && itemDefName.startsWith('Remove Keychain Tool')) {
                elOK.SetDialogVariableInt('item_count', Number(InventoryAPI.GetItemAttributeValue(itemId, '{uint32}items count')));
                sOkButtonText = '#popup_useitem_button_getkeychaincharges:f';
            }
            if (itemDefName && itemDefName.startsWith('XpShopTicket')) {
                const bHasPrime = FriendsListAPI.GetFriendPrimeEligible(MyPersonaAPI.GetXuid());
                sOkButtonText = bHasPrime ? '#xpshop_pass_activate_open_armory' : '#SFUI_Elevated_Status_upgrade_status';
            }
            if (itemDefName?.includes('tournament_pass_') && itemDefName?.includes('_credits')) {
                $.GetContextPanel().Data().majorCreditsToClaim = Number(InventoryAPI.GetItemAttributeValue(itemId, '{uint32}upgrade level'));
            }
        }
        elOK.text = sOkButtonText;
        elOK.AddClass(btnStyle);
        _SetPanelEventOnAccept();
    }
    function _SetUpOfferLimitDropdown(elDropdown) {
        const oLimits = JSON.parse(InventoryAPI.GetVolatileLimits());
        for (let i = 0; i < oLimits.choices.length; i++) {
            if (!elDropdown.HasOption('id-dropdown-limit-' + oLimits.choices[i].limit)) {
                let elOption = $.CreatePanel('Label', elDropdown, 'id-dropdown-limit-' + oLimits.choices[i].limit, {
                    class: 'DropDownMenu'
                });
                elOption.SetDialogVariable('limit', $.Localize(oLimits.choices[i].label));
                elOption.text = $.Localize('#offer_limit_setting', elOption);
                elOption.SetAttributeUInt32('limit', oLimits.choices[i].limit);
                elDropdown.AddOption(elOption);
            }
        }
        elDropdown.SetPanelEvent('oninputsubmit', () => _OnOfferLimitDropdownSubmit(elDropdown));
        elDropdown.SetSelected('id-dropdown-limit-' + oLimits.limit);
    }
    function _OnOfferLimitDropdownSubmit(elDropdown) {
        const elSelected = elDropdown.GetSelected();
        const nLimit = elSelected.GetAttributeUInt32('limit', 0);
        InventoryAPI.SetVolatileLimits(nLimit);
    }
    function _SetUpDescription(elPanel) {
        const elDescLabel = elPanel.FindChildInLayoutFile('AsyncItemWorkDesc');
        const elDescImage = elPanel.FindChildInLayoutFile('AsyncItemWorkDescImage');
        const worktype = InspectShared.GetPopupSetting('work_type');
        const toolId = InspectShared.GetPopupSetting('tool_id');
        const showAsyncActionDesc = InspectShared.GetPopupSetting('override_async_bar_desc');
        const showXrayMachineUi = InspectShared.GetPopupSetting('is_xray_machine');
        elDescLabel.SetHasClass('popup-capability-faded', showXrayMachineUi && !InspectShared.GetPopupSetting('allow_xray_claim'));
        elDescImage.SetHasClass('popup-capability-faded', showXrayMachineUi && !InspectShared.GetPopupSetting('allow_xray_claim'));
        if (showAsyncActionDesc) {
            elDescImage.itemid = toolId;
            const itemName = InventoryAPI.GetItemName(toolId);
            if (itemName) {
                elDescLabel.SetDialogVariable('itemname', itemName);
                elDescLabel.text = $.Localize('#popup_' + worktype + '_async_desc', elDescLabel);
            }
        }
        elDescLabel.visible = showAsyncActionDesc;
    }
    function EnableDisableOkBtn(elPanel, bEnable) {
        const elOK = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm');
        if (elOK.visible) {
            if (elOK.enabled !== bEnable)
                elOK.TriggerClass('popup-capability-update-anim');
            elOK.enabled = bEnable;
        }
        let elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
        if (elNegative && elNegative.visible) {
            if (elNegative.enabled !== bEnable)
                elNegative.TriggerClass('popup-capability-update-anim');
            elNegative.enabled = bEnable;
        }
        elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
        if (elNegative && elNegative.visible) {
            if (elNegative.enabled !== bEnable)
                elNegative.TriggerClass('popup-capability-update-anim');
            elNegative.enabled = bEnable;
        }
    }
    InspectAsyncActionBar.EnableDisableOkBtn = EnableDisableOkBtn;
    function ShowHideOkBtn(elPanel, bShow) {
        const elOK = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm');
        elOK.SetHasClass('move-down', !bShow);
        let elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
        if (elNegative)
            elNegative.SetHasClass('move-down', !bShow);
        elNegative = elPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
        if (elNegative)
            elNegative.SetHasClass('move-down', !bShow);
    }
    InspectAsyncActionBar.ShowHideOkBtn = ShowHideOkBtn;
    function _OnAccept(oSettings, elAsyncActionBarPanel, bForceRemoveSticker = false) {
        ResetTimeouthandle();
        const worktype = oSettings.work_type;
        const itemId = oSettings.item_id;
        if (worktype === 'useitem') {
            if (ItemInfo.ItemDefinitionNameSubstrMatch(itemId, 'XpShopTicket')) {
                const bHasPrime = FriendsListAPI.GetFriendPrimeEligible(MyPersonaAPI.GetXuid());
                if (!bHasPrime) {
                    UiToolkitAPI.ShowCustomLayoutPopup('prime_status', 'file://{resources}/layout/popups/popup_prime_status.xml');
                    return;
                }
                const oXpShopTrackProgress = InventoryAPI.GetCacheTypeElementJSOByIndex('XpShop', 0);
                const bTooManyTracks = (oXpShopTrackProgress && (oXpShopTrackProgress.xp_tracks.length >= StoreAPI.GetXpShopMaxTracks()));
                if (bTooManyTracks) {
                    UiToolkitAPI.ShowGenericPopupOk('#CSGO_Purchasable_XpShop_Ticket', '#CSGO_Purchasable_XpShop_Ticket_TooManyTracks', '', () => { });
                    return;
                }
                ResetTimeouthandle();
                _ClosePopup();
                $.DispatchEvent('MainMenuGoToStore', 'id-store-nav-xpshop');
                return;
            }
        }
        if (worktype === 'useitem' || worktype === 'decodeable') {
            const strToolType = InventoryAPI.GetToolType(itemId);
            if (strToolType === 'fantoken') {
                const nTournamentEventID = InventoryAPI.GetItemAttributeValue(itemId, '{uint32}tournament event id');
                if (nTournamentEventID && (nTournamentEventID > 0)) {
                    const coinItemId = InventoryAPI.GetActiveTournamentCoinItemId(nTournamentEventID);
                    if (coinItemId && (coinItemId !== '0')) {
                        $.DispatchEvent('CSGOPlaySoundEffect', 'sticker_applyConfirm', 'MOUSE');
                        UiToolkitAPI.ShowGenericPopupOk(InventoryAPI.GetItemName(coinItemId), '#Store_DuplicateItemInBackpack', '', () => {
                            ResetTimeouthandle();
                            _ClosePopup();
                            $.DispatchEvent("ShowCustomLayoutPopupParametersAsEvent", '', 'file://{resources}/layout/popups/popup_inventory_inspect.xml', 'item_id=' + coinItemId +
                                ',inspect_only=true,force_inspect_view_type=primary');
                        });
                        return;
                    }
                }
            }
        }
        _PerformAsyncAction(oSettings, bForceRemoveSticker);
        if (worktype === 'craft_souvenir')
            return;
        let elNegative = elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
        if (elNegative)
            elNegative.AddClass('hidden');
        elNegative = elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
        if (elNegative)
            elNegative.AddClass('hidden');
        elAsyncActionBarPanel.FindChildInLayoutFile('NameableSpinner').RemoveClass('hidden');
        elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm').AddClass('hidden');
    }
    function _ShowHideInspectViewButtons(elAsyncActionBarPanel) {
        const worktype = InspectShared.GetPopupSetting('work_type');
        if (worktype === 'can_sticker' || worktype === 'can_keychain') {
            const elApplyPickSlot = $.GetContextPanel().FindChildInLayoutFile('PopUpCanApplyPickSlot');
            elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn').SetPanelEvent('onactivate', () => {
                InspectModelImage.EndWeaponLookat();
                CanApplyPickSlot.ShowHideInfoPanel(false, elApplyPickSlot);
                CanApplyPickSlot.IsContinueEnabled(elApplyPickSlot);
                ShowHideOkBtn(elAsyncActionBarPanel, true);
                EnableDisableOkBtn(elAsyncActionBarPanel, !CanApplyPickSlot.IsContinueEnabled(elApplyPickSlot));
                elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkCancelBtn').text = "#GameUI_Close";
                if (elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom').visible) {
                    elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom').enabled = true;
                }
            });
            elAsyncActionBarPanel.FindChildInLayoutFile('LookatWeaponBtn').SetPanelEvent('onactivate', () => {
                InspectModelImage.StartWeaponLookat();
                CanApplyPickSlot.ShowHideInfoPanel(true, elApplyPickSlot);
                ShowHideOkBtn(elAsyncActionBarPanel, false);
                EnableDisableOkBtn(elAsyncActionBarPanel, false);
                elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkCancelBtn').text = "#SFUI_Back";
                elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom').enabled = false;
            });
            elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn').GetParent().SetHasClass('hidden', false);
        }
        else {
            elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn').GetParent().SetHasClass('hidden', true);
        }
        elAsyncActionBarPanel.FindChildInLayoutFile('ChangeScenery').SetHasClass('hidden', worktype === 'decodeable' || worktype === 'remove_patch'
            || worktype === 'can_wrap_sticker' || worktype === 'craft_souvenir'
            || worktype === 'remove_sticker' || worktype === 'remove_keychain');
    }
    function _ChangeSceneryBtn(elAsyncActionBarPanel) {
        elAsyncActionBarPanel.FindChildInLayoutFile('ChangeScenery').SetPanelEvent('onactivate', UpdateScenery);
    }
    function UpdateScenery() {
        UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent('id-inspect-contextmenu-maps', '', 'file://{resources}/layout/context_menus/context_menu_mainmenu_vanity.xml', 'type=maps' +
            '&' + 'inspect-map=true', () => { $.DispatchEvent('ContextMenuEvent', ''); });
    }
    InspectAsyncActionBar.UpdateScenery = UpdateScenery;
    function EnableDisableChangeSceneryBtn(bEnable, elAsyncActionBarPanel) {
        elAsyncActionBarPanel.FindChildInLayoutFile('ChangeScenery').enabled = bEnable;
    }
    InspectAsyncActionBar.EnableDisableChangeSceneryBtn = EnableDisableChangeSceneryBtn;
    function _ShowZoomBtn(elAsyncActionBarPanel) {
        if (InspectModelImage.PanZoomEnabled() || InspectShared.GetPopupSetting('work_type') === 'nameable')
            return;
        const defName = InventoryAPI.GetItemDefinitionName(InspectShared.GetPopupSetting('item_id'));
        const result = InspectModelImage.m_CameraSettingsPerWeapon.find(({ type }) => type === defName);
        if (!result || !result.hasOwnProperty('zoom_camera'))
            return;
        const elZoomBtn = elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom');
        elZoomBtn.SetPanelEvent('onactivate', () => ZoomCamera(false, elAsyncActionBarPanel));
        elZoomBtn.SetHasClass('hidden', false);
    }
    function ZoomCamera(bForceZoomOut = false, elAsyncActionBarPanel) {
        const elZoomButton = elAsyncActionBarPanel.FindChildInLayoutFile('InspectItemModelZoom');
        if (bForceZoomOut) {
            InspectModelImage.ZoomCamera(false);
            elZoomButton.checked = false;
            return;
        }
        if (elZoomButton.checked) {
            InspectModelImage.ZoomCamera(true);
        }
        else {
            InspectModelImage.ZoomCamera(false);
        }
    }
    InspectAsyncActionBar.ZoomCamera = ZoomCamera;
    function OnCloseRemove(elAsyncActionBarPanel) {
        if (elAsyncActionBarPanel.IsValid()) {
            elAsyncActionBarPanel.FindChildInLayoutFile('NameableSpinner').AddClass('hidden');
            elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptConfirm').RemoveClass('hidden');
            let elNegative = elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegative');
            if (elNegative)
                elNegative.RemoveClass('hidden');
            elNegative = elAsyncActionBarPanel.FindChildInLayoutFile('AsyncItemWorkAcceptNegativeHold');
            if (elNegative)
                elNegative.RemoveClass('hidden');
        }
    }
    InspectAsyncActionBar.OnCloseRemove = OnCloseRemove;
    function _ClosePopup() {
        ResetTimeouthandle();
        HoldButton.StopLoopingSound('UI.Laptop.ButtonFillLoop');
        $.DispatchEvent('HideSelectItemForCapabilityPopup');
        $.DispatchEvent('UIPopupButtonClicked', '');
        $.DispatchEvent('CapabilityPopupIsOpen', false);
    }
    function SetCallbackTimeout() {
        const elPanel = $.GetContextPanel();
        m_scheduleHandle = $.Schedule(5, () => _CancelWaitforCallBack(elPanel));
    }
    InspectAsyncActionBar.SetCallbackTimeout = SetCallbackTimeout;
    function _CancelWaitforCallBack(elPanel) {
        m_scheduleHandle = null;
        const elSpinner = elPanel.FindChildInLayoutFile('NameableSpinner');
        elSpinner.AddClass('hidden');
        _ClosePopup();
        UiToolkitAPI.ShowGenericPopupOk($.Localize('#SFUI_SteamConnectionErrorTitle'), $.Localize('#SFUI_InvError_Item_Not_Given'), '', () => { });
    }
    function OnEventToClose() {
        const worktype = InspectShared.GetPopupSetting('work_type');
        const elAsyncActionBarPanel = $.GetContextPanel().FindChildInLayoutFile('PopUpInspectAsyncBar');
        if (_DefaultZoomView(worktype, elAsyncActionBarPanel) === false)
            _ClosePopup();
    }
    InspectAsyncActionBar.OnEventToClose = OnEventToClose;
    function _DefaultZoomView(worktype, elAsyncActionBarPanel) {
        if (elAsyncActionBarPanel && (worktype === 'can_sticker' || worktype === 'can_keychain')) {
            const elLookatBtn = elAsyncActionBarPanel.FindChildInLayoutFile('LookatWeaponBtn');
            if (elLookatBtn && elLookatBtn.IsValid()
                && elLookatBtn.checked
                && m_scheduleHandle === null) {
                $.DispatchEvent("Activated", elAsyncActionBarPanel.FindChildInLayoutFile('InspectWeaponBtn'), "mouse");
                return true;
            }
        }
        return false;
    }
    function ResetTimeouthandle() {
        if (m_scheduleHandle) {
            $.CancelScheduled(m_scheduleHandle);
            m_scheduleHandle = null;
        }
    }
    InspectAsyncActionBar.ResetTimeouthandle = ResetTimeouthandle;
    function _OnItemCustomization(numericType, type, itemid, cp = $.GetContextPanel()) {
        const worktype = InspectShared.GetPopupSetting('work_type');
        if (_IgnoreClose()) {
            ResetTimeouthandle();
            return;
        }
        if (worktype === 'craft_souvenir' && type === 'reward_redeemed') {
            _ClosePopup();
            return;
        }
        OnEventToClose();
        if (type === 'xp_shop_use_ticket' || type === 'xp_shop_ack_tracks') {
        }
        else if (type === 'keychain_tool_charges' && worktype === 'useitem') {
            const defidxContract = InventoryAPI.GetItemDefinitionIndexFromDefinitionName("Remove Keychain Tool");
            const fauxItemID = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxContract, 0);
            $.DispatchEvent("ShowCustomLayoutPopupParametersAsEvent", '', 'file://{resources}/layout/popups/popup_inventory_inspect.xml', 'item_id=' + fauxItemID +
                ',' + 'inspect_only=true');
        }
        else if (type === 'seasontiers') {
            const popupPanel = UiToolkitAPI.ShowCustomLayoutPopup('id-popup-major-store', 'file://{resources}/layout/popups/popup_major_store.xml');
            popupPanel.Data().activatedCredits = cp.Data().majorCreditsToClaim;
        }
        else {
            $.DispatchEvent('ShowAcknowledgePopup', type, itemid);
        }
    }
    function _IgnoreClose() {
        return InspectShared.GetPopupSetting('work_type') === 'decodeable';
    }
    let m_panelsToSetCost = [];
    function _ComputeTotalSouvenirCost(cp, itemIdSouvenir) {
        const tempCreatedItem = itemIdSouvenir ?? InspectShared.GetPopupSetting('temp_display_item_id');
        let nTotalCostInCredits = 0;
        {
            const defidxStickerItem = InventoryAPI.GetItemDefinitionIndexFromDefinitionName('sticker');
            for (let i = 0; i < 6; ++i) {
                const idStickerKit = InventoryAPI.GetItemAttributeValue(tempCreatedItem, '{uint32}sticker slot ' + i + ' id');
                if (!idStickerKit)
                    continue;
                const idFauxSticker = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidxStickerItem, idStickerKit);
                const unCostInCredits = MissionsAPI.GetSeasonalOperationFauxCreditsCost(g_ActiveTournamentInfo.credits_id, idFauxSticker);
                if (unCostInCredits)
                    nTotalCostInCredits += unCostInCredits;
                else
                    nTotalCostInCredits += g_ActiveTournamentInfo.souvenir_cost;
            }
        }
        const discountAmount = InventoryAPI.GetItemSouvenirDiscountPercent(tempCreatedItem);
        const discountCredits = Math.trunc(nTotalCostInCredits * discountAmount / 100);
        if (discountCredits < nTotalCostInCredits)
            nTotalCostInCredits -= discountCredits;
        return nTotalCostInCredits;
    }
    let m_SouvenirCheckoutCart = ShoppingCart.cart;
    function _OnVolatileShopSubscribe(nContainerDef, bNewPricesParsed, cp) {
        const nTotalCostInCredits = _ComputeTotalSouvenirCost(cp);
        if (m_SouvenirCheckoutCart !== ShoppingCart.cart) {
            m_SouvenirCheckoutCart.syncPrices((itemId) => {
                return nTotalCostInCredits;
            });
        }
        m_panelsToSetCost.forEach((p) => {
            if (p && p.IsValid()) {
                p.SetDialogVariableInt('cost_souvenir', nTotalCostInCredits);
                p.SetDialogVariable('action-label', $.Localize('#popup_craft_souvenir_button_spend', p));
            }
        });
        let oApplySettings = {
            headerPanel: $.GetContextPanel().FindChildInLayoutFile('PopUpCanApplyHeader'),
            infoPanel: $.GetContextPanel().FindChildInLayoutFile('PopUpCanApplyPickSlot'),
            asyncBarPanel: $.GetContextPanel().FindChildInLayoutFile('PopUpInspectAsyncBar'),
            contextPanel: $.GetContextPanel(),
            itemId: InspectShared.GetPopupSetting('temp_display_item_id') ? InspectShared.GetPopupSetting('temp_display_item_id') : InspectShared.GetPopupSetting('item_id'),
            toolId: InspectShared.GetPopupSetting('tool_id'),
            isRemove: false,
            type: '',
            funcOnConfirm: () => { },
            funcOnNext: () => { },
            funcOnCancel: () => { },
            funcOnSelectForRemove: () => { }
        };
        CanApplyPickSlot.Init(oApplySettings);
    }
    function _OnMyPersonaInventoryUpdated() {
        if (InspectShared.GetPopupSetting('is_season_pass') && InventoryAPI.IsValidItemID(InspectShared.GetPopupSetting('item_id'))) {
            return;
        }
        const worktype = InspectShared.GetPopupSetting('work_type');
        if (worktype === "remove_sticker" ||
            worktype === "remove_patch" ||
            worktype === "remove_keychain" ||
            worktype === "can_sticker" ||
            worktype === "can_wrap_sticker" ||
            worktype === "craft_souvenir" ||
            worktype === "can_patch" ||
            worktype === "can_keychain" ||
            worktype === "useitem" ||
            worktype === "nameable") {
            return;
        }
        OnEventToClose();
    }
    function _OnInventoryPrestigeCoinResponse(defidx, upgradeid, hours, prestigetime) {
        OnEventToClose();
        if (InspectShared.GetPopupSetting('work_type') === 'prestigecheck') {
            const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
            let oSettings = {
                item_id: InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(defidx, 0),
                show_work_type_warning: false,
                work_type: (upgradeid === '0') ? 'prestigeget' : 'prestigeupgrade'
            };
            elPanel.Data().oSettings = oSettings;
        }
        else if (upgradeid !== '0') {
            InventoryAPI.AcknowledgeNewItembyItemID(upgradeid);
            InventoryAPI.SetItemSessionPropertyValue(upgradeid, 'recent', '1');
            $.DispatchEvent('InventoryItemPreview', upgradeid, '');
        }
    }
})(InspectAsyncActionBar || (InspectAsyncActionBar = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfaW5zcGVjdF9hc3luYy1iYXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9wb3B1cHMvcG9wdXBfaW5zcGVjdF9hc3luYy1iYXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxpREFBaUQ7QUFDakQsOENBQThDO0FBQzlDLHNDQUFzQztBQUN0QyxnREFBZ0Q7QUFDaEQscURBQXFEO0FBQ3JELDRFQUE0RTtBQUM1RSxtREFBbUQ7QUFFbkQsSUFBVSxxQkFBcUIsQ0Ewc0M5QjtBQTFzQ0QsV0FBVSxxQkFBcUI7SUFFOUIsSUFBSSxnQkFBZ0IsR0FBa0IsSUFBSSxDQUFDO0lBRTNDLFNBQWdCLElBQUk7UUFFbkIsTUFBTSxRQUFRLEdBQUcsYUFBYSxDQUFDLGVBQWUsQ0FBRSxXQUFXLENBQUUsQ0FBQztRQUM5RCxNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsZUFBZSxDQUFFLFNBQVMsQ0FBRSxDQUFDO1FBQzFELE1BQU0saUJBQWlCLEdBQUcsYUFBYSxDQUFDLGVBQWUsQ0FBRSxpQkFBaUIsQ0FBRSxDQUFDO1FBQzdFLE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQyxlQUFlLENBQUUsWUFBWSxDQUFFLENBQUM7UUFDbEUsTUFBTSxxQkFBcUIsR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUMscUJBQXFCLENBQUUsc0JBQXNCLENBQUUsQ0FBQztRQUVsRyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUMsUUFBUSxDQUFFLHVCQUF1QixHQUFHLFFBQVEsQ0FBRSxDQUFDO1FBSW5FLElBQUssYUFBYSxDQUFDLGVBQWUsQ0FBRSxzQkFBc0IsQ0FBRTtZQUMzRCxDQUFDLFFBQVE7WUFDVCxDQUFFLFdBQVcsSUFBSSxDQUFDLGlCQUFpQixDQUFFO1lBQ3JDLENBQUUsUUFBUSxLQUFLLFVBQVUsSUFBSSxDQUFDLE1BQU0sQ0FBRTtZQUN0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