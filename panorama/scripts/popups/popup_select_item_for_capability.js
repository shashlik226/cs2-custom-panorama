"use strict";
/// <reference path="../csgo.d.ts" />
/// <reference path="popup_capability_header.ts" />
/// <reference path="popup_inspect_action-bar.ts" />
/// <reference path="popup_inspect_shared.ts" />
/// <reference path="../common/iteminfo.ts" />
/// <reference path="../inspect.ts" />
var SelectItemForCapability;
(function (SelectItemForCapability) {
    let _m_cp = $.GetContextPanel();
    let _m_elItemList = _m_cp.FindChildInLayoutFile('id-popup-select-item-list');
    SelectItemForCapability.oCapabilityInfo = {
        capability: '',
        initialItemId: '',
        multiselectItemIds: {},
        multiselectItemIdsArray: [],
        popupVisible: false,
        bWorkshopItemPreview: false,
        bIsMultiSelect: false
    };
    function Init() {
        SelectItemForCapability.oCapabilityInfo.initialItemId = _m_cp.GetAttributeString('itemid', '');
        SelectItemForCapability.oCapabilityInfo.secondaryItemId = _m_cp.GetAttributeString('secondaryItemid', '');
        SelectItemForCapability.oCapabilityInfo.bWorkshopItemPreview = _m_cp.GetAttributeString("bWorkshopItemPreview", 'false') === 'true' ? true : false;
        SelectItemForCapability.oCapabilityInfo.capability = _m_cp.GetAttributeString("capability", '');
        SelectItemForCapability.oCapabilityInfo.bIsMultiSelect = (SelectItemForCapability.oCapabilityInfo.capability === "casketstore" || SelectItemForCapability.oCapabilityInfo.capability === "casketretrieve");
        SelectItemForCapability.oCapabilityInfo.popupVisible = true;
        $.DispatchEvent('CapabilityPopupIsOpen', true);
        _m_cp.FindChildInLayoutFile('id-initial-item-image').itemid = SelectItemForCapability.oCapabilityInfo.initialItemId;
        _m_elItemList.SetHasClass('inv-multi-select-allow', SelectItemForCapability.oCapabilityInfo.bIsMultiSelect);
        _m_cp.SetDialogVariable('item-name', InventoryAPI.GetItemName(SelectItemForCapability.oCapabilityInfo.initialItemId));
        _SetTitle();
        let elDropDownParent = _m_cp.FindChildInLayoutFile('id-dropdown-container');
        _AddSortDropdownToNavBar(elDropDownParent);
        _UpdateMultiSelectDisplay();
    }
    SelectItemForCapability.Init = Init;
    function _SetTitle() {
        let szPrefixString = '#inv_select_item_use_capability';
        if (SelectItemForCapability.oCapabilityInfo.capability === 'can_stattrack_swap') {
            szPrefixString = InventoryAPI.IsTool(SelectItemForCapability.oCapabilityInfo.initialItemId) ?
                '#inv_select_item_use_capability' :
                '#inv_select_item_stattrack_swap_capability';
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'can_collect') {
            let defName = InventoryAPI.GetItemDefinitionName(SelectItemForCapability.oCapabilityInfo.initialItemId);
            szPrefixString = (defName === 'casket') ?
                '#inv_select_item_tostoreincasket' :
                '#inv_select_casketitem_tostorethis';
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'casketcontents') {
            szPrefixString = '#inv_select_casketcontents';
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'casketretrieve') {
            szPrefixString = '#inv_select_casketretrieve';
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'casketstore') {
            szPrefixString = '#inv_select_casketstore';
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'craft_souvenir') {
            szPrefixString = '#inv_select_item_craft_souvenir';
        }
        _m_cp.AddClass('PopupSelectItemForCapability_' + SelectItemForCapability.oCapabilityInfo.capability);
        _m_cp.SetDialogVariable('title', $.Localize(szPrefixString, _m_cp));
    }
    function _AddSortDropdownToNavBar(elDropDownParent) {
        let elDropdown = elDropDownParent.FindChildInLayoutFile('InvSortDropdown');
        let count = InventoryAPI.GetSortMethodsCount();
        for (let i = 0; i < count; i++) {
            let sort = InventoryAPI.GetSortMethodByIndex(i);
            let newEntry = $.CreatePanel('Label', elDropdown, sort, {
                class: 'DropDownMenu'
            });
            newEntry.text = $.Localize('#' + sort);
            elDropdown.AddOption(newEntry);
        }
        elDropdown.SetPanelEvent('oninputsubmit', () => UpdateSort());
        elDropdown.SetSelected(GameInterfaceAPI.GetSettingString("newest"));
    }
    function UpdateSort() {
        let elDropdown = _m_cp.FindChildInLayoutFile('InvSortDropdown');
        const sortString = (!elDropdown || !elDropdown.GetSelected()) ? 'newest' : elDropdown.GetSelected().id;
        let filterApplicationToPhantomItems = ItemInfo.IsFauxOrRentalOrPreviewTool(SelectItemForCapability.oCapabilityInfo.initialItemId) ? '' : ',is_rental:false,is_sealed:false';
        let capabilityFilter = SelectItemForCapability.oCapabilityInfo.capability + ':' + SelectItemForCapability.oCapabilityInfo.initialItemId + filterApplicationToPhantomItems;
        $.DispatchEvent('SetInventoryFilter', _m_elItemList, 'any', 'any', 'any', sortString, capabilityFilter, '');
        _ShowHideNoItemsMessage();
    }
    SelectItemForCapability.UpdateSort = UpdateSort;
    function _ShowHideNoItemsMessage() {
        let count = _m_elItemList.count;
        let elParent = _m_elItemList.GetParent();
        let elEmpty = elParent.FindChildInLayoutFile('id-select-item-empty-lister');
        if (count > 0) {
            elEmpty.visible = false;
            return;
        }
        let emptyText = '';
        elEmpty.SetDialogVariable('type', InventoryAPI.GetItemName(SelectItemForCapability.oCapabilityInfo.initialItemId));
        if ((SelectItemForCapability.oCapabilityInfo.capability === 'can_stattrack_swap') && !InventoryAPI.IsTool(SelectItemForCapability.oCapabilityInfo.initialItemId))
            emptyText = $.Localize('#inv_empty_lister_for_stattrackswap', elEmpty);
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'can_collect')
            emptyText = $.Localize('#inv_empty_lister_nocaskets', elEmpty);
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'craft_souvenir')
            emptyText = $.Localize('#inv_empty_lister_for_craft_souvenir', elEmpty);
        else
            emptyText = $.Localize('#inv_empty_lister_for_use', elEmpty);
        elEmpty.SetDialogVariable('empty-text', emptyText);
        elEmpty.visible = true;
    }
    function _UpdateMultiSelectItemsList(itemid, bSelected) {
        if (bSelected) {
            if (!SelectItemForCapability.oCapabilityInfo.multiselectItemIds.hasOwnProperty(itemid)) {
                SelectItemForCapability.oCapabilityInfo.multiselectItemIds[itemid] = bSelected;
                SelectItemForCapability.oCapabilityInfo.multiselectItemIdsArray.push(itemid);
            }
        }
        else {
            if (SelectItemForCapability.oCapabilityInfo.multiselectItemIds.hasOwnProperty(itemid)) {
                delete SelectItemForCapability.oCapabilityInfo.multiselectItemIds[itemid];
                SelectItemForCapability.oCapabilityInfo.multiselectItemIdsArray.splice(SelectItemForCapability.oCapabilityInfo.multiselectItemIdsArray.indexOf(itemid), 1);
            }
        }
        _UpdateMultiSelectDisplay();
    }
    function _UpdateMultiSelectDisplay() {
        const elMultiSelectDisplay = _m_cp.FindChildInLayoutFile('id-popup-select-multi-item-display');
        if (!SelectItemForCapability.oCapabilityInfo.bIsMultiSelect) {
            elMultiSelectDisplay.visible = false;
            return;
        }
        SelectItemForCapability.oCapabilityInfo.capability === "";
        elMultiSelectDisplay.SetDialogVariableInt('count', SelectItemForCapability.oCapabilityInfo.multiselectItemIdsArray.length);
        _m_cp.FindChildInLayoutFile('id-popup-select-multi-item-btn').enabled = (SelectItemForCapability.oCapabilityInfo.multiselectItemIdsArray.length > 0);
        elMultiSelectDisplay.visible = true;
    }
    function ClosePopUp() {
        if (_m_cp.IsValid()) {
            const callbackFunc = _m_cp.GetAttributeInt('callback', -1);
            if (callbackFunc != -1) {
                UiToolkitAPI.InvokeJSCallback(callbackFunc);
            }
        }
        SelectItemForCapability.oCapabilityInfo.popupVisible = false;
        $.DispatchEvent('CSGOPlaySoundEffect', 'inventory_inspect_close', 'MOUSE');
        $.DispatchEvent('CapabilityPopupIsOpen', false);
        $.DispatchEvent('BlurPopupPanel', 'popup-lootlist-item-inspect-' + SelectItemForCapability.oCapabilityInfo.initialItemId, false);
        $.DispatchEvent('UIPopupButtonClicked', '');
    }
    SelectItemForCapability.ClosePopUp = ClosePopUp;
    function _OnItemTileActivated(itemTile, itemid) {
        $.DispatchEvent('CSGOPlaySoundEffect', 'inventory_item_select', 'MOUSE');
        if (SelectItemForCapability.oCapabilityInfo.capability === 'can_sticker') {
            _CapabilityCanStickerAction(SortIdsIntoToolAndItemID(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId), SelectItemForCapability.oCapabilityInfo.bWorkshopItemPreview);
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'can_wrap_sticker') {
            _CapabilityWrapStickerAsKeychainAction(SortIdsIntoToolAndItemID(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId, ItemInfo.IsSticker));
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'nameable') {
            _CapabilityNameableAction(SortIdsIntoToolAndItemID(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId));
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'can_keychain') {
            _CapabilityCanKeychainAction(SortIdsIntoToolAndItemID(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId), SelectItemForCapability.oCapabilityInfo.bWorkshopItemPreview);
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'remove_keychain') {
            _CapabilityRemoveKeychainAction(SortIdsIntoToolAndItemID(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId));
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'can_patch') {
            _CapabilityCanPatchAction(SortIdsIntoToolAndItemID(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId));
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'decodable') {
            _CapabilityDecodableAction(SortIdsIntoToolAndItemID(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId));
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'can_stattrack_swap') {
            _CapabilityStatTrakSwapAction(SelectItemForCapability.oCapabilityInfo, itemid);
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'can_collect') {
            _CapabilityPutIntoCasketAction(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId);
        }
        if (SelectItemForCapability.oCapabilityInfo.capability === 'casketretrieve') {
            itemTile.ToggleClass('capability_multistatus_selected');
            _UpdateMultiSelectItemsList(itemid, itemTile.BHasClass('capability_multistatus_selected'));
            return;
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'casketstore') {
            itemTile.ToggleClass('capability_multistatus_selected');
            _UpdateMultiSelectItemsList(itemid, itemTile.BHasClass('capability_multistatus_selected'));
            return;
        }
        else if (SelectItemForCapability.oCapabilityInfo.capability === 'craft_souvenir') {
            _CapabilityCraftSouvenirAction(itemid, SelectItemForCapability.oCapabilityInfo.initialItemId);
        }
        ClosePopUp();
    }
    function SortIdsIntoToolAndItemID(id, initalId, fnWhatIsTool) {
        let bIdIsTool = fnWhatIsTool ? fnWhatIsTool(id) : InventoryAPI.IsTool(id);
        let toolId = bIdIsTool ? id : initalId;
        let itemID = bIdIsTool ? initalId : id;
        return {
            tool: toolId,
            item: itemID
        };
    }
    ;
    function _CapabilityCanStickerAction(idsToUse, bWorkshopItemPreview) {
        const workshopPreview = bWorkshopItemPreview ? 'true' : 'false';
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + idsToUse.item, 'file://{resources}/layout/popups/popup_capability_can_sticker.xml');
        let oSettings = {
            popup_panel: elPanel,
            item_id: idsToUse.item,
            tool_id: idsToUse.tool,
            work_type: 'can_sticker',
            is_workshop_preview: bWorkshopItemPreview
        };
        elPanel.Data().oSettings = oSettings;
    }
    ;
    function _CapabilityNameableAction(idsToUse) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + idsToUse.item, 'file://{resources}/layout/popups/popup_capability_nameable.xml');
        let oSettings = {
            item_id: idsToUse.item,
            tool_id: idsToUse.tool,
            work_type: 'nameable'
        };
        elPanel.Data().oSettings = oSettings;
    }
    ;
    function _CapabilityCanKeychainAction(idsToUse, bWorkshopItemPreview) {
        const workshopPreview = bWorkshopItemPreview ? 'true' : 'false';
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + idsToUse.item, 'file://{resources}/layout/popups/popup_capability_can_keychain.xml');
        let oSettings = {
            popup_panel: elPanel,
            tool_id: idsToUse.tool,
            item_id: idsToUse.item,
            work_type: 'can_keychain',
            is_workshop_preview: bWorkshopItemPreview
        };
        elPanel.Data().oSettings = oSettings;
    }
    ;
    function _CapabilityCraftSouvenirAction(itemid, umid) {
        if (InventoryAPI.GetItemStickerCount(itemid) > 0) {
            const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_capability_can_sticker.xml');
            let oSettings = {
                popup_panel: elPanel,
                item_id: itemid,
                remove_sticker_all_at_once: true,
                work_type: 'remove_sticker',
                umid_souvenir: umid
            };
            elPanel.Data().oSettings = oSettings;
        }
        else {
            const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + itemid, 'file://{resources}/layout/popups/popup_capability_can_keychain.xml');
            let oSettings = {
                item_id: itemid,
                tool_id: '',
                umid_souvenir: umid,
                work_type: 'craft_souvenir'
            };
            elPanel.Data().oSettings = oSettings;
        }
    }
    function _CapabilityWrapStickerAsKeychainAction(idsToUse) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + idsToUse.item, 'file://{resources}/layout/popups/popup_capability_can_keychain.xml');
        let oSettings = {
            item_id: idsToUse.item,
            tool_id: idsToUse.tool,
            work_type: 'can_wrap_sticker'
        };
        elPanel.Data().oSettings = oSettings;
    }
    ;
    function _CapabilityRemoveKeychainAction(idsToUse) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + idsToUse.item, 'file://{resources}/layout/popups/popup_capability_can_keychain.xml');
        let oSettings = {
            item_id: idsToUse.item,
            work_type: 'remove_keychain'
        };
        elPanel.Data().oSettings = oSettings;
    }
    ;
    function _CapabilityCanPatchAction(idsToUse) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + idsToUse.item, 'file://{resources}/layout/popups/popup_capability_can_patch.xml');
        let oSettings = {
            item_id: idsToUse.item,
            tool_id: idsToUse.tool,
            work_type: 'can_patch'
        };
        elPanel.Data().oSettings = oSettings;
    }
    ;
    function _CapabilityDecodableAction(idsToUse) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + idsToUse.item, 'file://{resources}/layout/popups/popup_capability_decodable.xml');
        let oSettings = {
            item_id: idsToUse.item,
            tool_id: idsToUse.tool,
            work_type: 'decodeable'
        };
        elPanel.Data().oSettings = oSettings;
    }
    ;
    function _CapabilityStatTrakSwapAction(capInfo, id) {
        if (InventoryAPI.IsTool(capInfo.initialItemId)) {
            const sWorkshop = false;
            $.DispatchEvent('CSGOPlaySoundEffect', 'tab_mainmenu_inventory', 'MOUSE');
            $.DispatchEvent('ShowSelectItemForCapabilityPopup', id, capInfo.initialItemId, capInfo.capability);
            ClosePopUp();
        }
        else {
            const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_capability_can_stattrack_swap.xml');
            let oSettings = {
                tool_id: capInfo.secondaryItemId,
                item_id: capInfo.initialItemId,
                stattrak_swap_second_item_id: id
            };
            elPanel.Data().oSettings = oSettings;
        }
    }
    ;
    function _CapabilityPutIntoCasketAction(idCasket, idItem, cap) {
        $.DispatchEvent('ContextMenuEvent', '');
        if (!cap) {
            $.DispatchEvent('HideSelectItemForCapabilityPopup');
            $.DispatchEvent('UIPopupButtonClicked', '');
            $.DispatchEvent('CapabilityPopupIsOpen', false);
        }
        if (InventoryAPI.GetItemAttributeValue(idCasket, 'modification date')) {
            UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_casket_operation.xml', 'op=add' +
                (cap ? '&nextcapability=' + cap : '') +
                '&spinner=1' +
                '&casket_item_id=' + idCasket +
                '&subject_item_id=' + idItem);
        }
        else {
            const fauxNameTag = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex(1200, 0);
            const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/popups/popup_capability_nameable.xml');
            let oSettings = {
                item_id: idCasket,
                tool_id: fauxNameTag,
                work_type: 'nameable',
                async_work_type_warning_text: '#popup_newcasket_warning'
            };
            elPanel.Data().oSettings = oSettings;
        }
    }
    ;
    function ProceedForMultiStatusCapabilityPopup() {
        let capability = SelectItemForCapability.oCapabilityInfo.capability;
        let arrItemIDs = SelectItemForCapability.oCapabilityInfo.multiselectItemIdsArray;
        if (arrItemIDs.length <= 0)
            return;
        switch (capability) {
            case 'casketretrieve':
                {
                    let strItemIDs = arrItemIDs.join(",");
                    UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_casket_operation.xml', 'op=remove' +
                        '&nextcapability=batch' +
                        '&spinner=1' +
                        '&casket_item_id=' + SelectItemForCapability.oCapabilityInfo.initialItemId +
                        '&subject_item_id=' + strItemIDs);
                    break;
                }
            case 'casketstore':
                {
                    let strItemIDs = arrItemIDs.join(",");
                    UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_casket_operation.xml', 'op=add' +
                        '&nextcapability=batch' +
                        '&spinner=1' +
                        '&casket_item_id=' + SelectItemForCapability.oCapabilityInfo.initialItemId +
                        '&subject_item_id=' + strItemIDs);
                    break;
                }
        }
        ClosePopUp();
    }
    SelectItemForCapability.ProceedForMultiStatusCapabilityPopup = ProceedForMultiStatusCapabilityPopup;
    function _UpdateSelectItemForCapabilityPopup(capability, itemid, bSelected) {
        if (SelectItemForCapability.oCapabilityInfo.capability !== capability)
            return false;
        if (!itemid)
            return false;
        _UpdateMultiSelectItemsList(itemid, bSelected);
        UpdateSort();
        return true;
    }
    {
        $.RegisterForUnhandledEvent("OnItemTileActivated", _OnItemTileActivated);
        $.RegisterForUnhandledEvent('UpdateSelectItemForCapabilityPopup', _UpdateSelectItemForCapabilityPopup);
    }
})(SelectItemForCapability || (SelectItemForCapability = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXBfc2VsZWN0X2l0ZW1fZm9yX2NhcGFiaWxpdHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9jb250ZW50L2NzZ28vcGFub3JhbWEvc2NyaXB0cy9wb3B1cHMvcG9wdXBfc2VsZWN0X2l0ZW1fZm9yX2NhcGFiaWxpdHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFDQUFxQztBQUNyQyxtREFBbUQ7QUFDbkQsb0RBQW9EO0FBQ3BELGdEQUFnRDtBQUNoRCw4Q0FBOEM7QUFDOUMsc0NBQXNDO0FBRXRDLElBQVUsdUJBQXVCLENBNGtCaEM7QUE1a0JELFdBQVUsdUJBQXVCO0lBRWhDLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztJQUNoQyxJQUFJLGFBQWEsR0FBSSxLQUFLLENBQUMscUJBQXFCLENBQUUsMkJBQTJCLENBQXlCLENBQUM7SUFhNUYsdUNBQWUsR0FBcUI7UUFDOUMsVUFBVSxFQUFFLEVBQUU7UUFDZCxhQUFhLEVBQUMsRUFBRTtRQUNoQixrQkFBa0IsRUFBRSxFQUFFO1FBQ3RCLHVCQUF1QixFQUFFLEVBQUU7UUFDM0IsWUFBWSxFQUFFLEtBQUs7UUFDbkIsb0JBQW9CLEVBQUUsS0FBSztRQUMzQixjQUFjLEVBQUUsS0FBSztLQUNyQixDQUFDO0lBRUYsU0FBZ0IsSUFBSTtRQUVuQix3QkFBQSxlQUFlLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBRSxRQUFRLEVBQUUsRUFBRSxDQUFFLENBQUM7UUFDekUsd0JBQUEsZUFBZSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUUsaUJBQWlCLEVBQUUsRUFBRSxDQUFFLENBQUM7UUFDcEYsd0JBQUEsZUFBZSxDQUFDLG9CQUFvQixHQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBRSxzQkFBc0IsRUFBRSxPQUFPLENBQUUsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxD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