'use strict';

var PopupGenerateSkins = ( function()
{
	var weapons = [ 4,32,61,2,36,30,3,63,1,64,7,16,60,13,10,40,39,8,9,11,38,17,34,33,23,24,19,26,35,25,29,27,14,28,49,42,59,500,505,506,507,508,509,515,512,516,514,522,519,523,520,521,517,518,503,525,5027,5030,5031,5032,5033,5034,5035,4725,1314 ];
	var skins = [];
	var gloves = [];
	var music = [];

	var latestWeaponSlot = '';
    
	function _Init()
	{
		weapons.forEach(weapon => {
			var itemName = InventoryAPI.GetItemName(InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( weapon, 0 ));
			var elDropdown = $.GetContextPanel().FindChildInLayoutFile('Weapon');
			var newEntry = $.CreatePanel('Label', elDropdown, "item"+weapon, {
				class: 'DropDownMenu Width-250 White',
				value: weapon,
				text: itemName
			});

			elDropdown.AddOption(newEntry);
		});
		$.GetContextPanel().FindChildInLayoutFile('Weapon').SetSelected( 'item'+weapons[0] );
		$.GetContextPanel().FindChildInLayoutFile('Weapon').SetPanelEvent('oninputsubmit', _OnWeaponDropdownChange);

		_GetAllPaints();
		
		_OnWeaponDropdownChange();
	}

	function _GetAllPaints()
	{
		for (var i = 0; i < 4000; i++) {
			var itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( 1, i );
			var itemName = InventoryAPI.GetItemName(itemId);

			if(itemName)
				itemName = itemName.split(' | ')[1];

			if(itemName == '' || itemName == undefined || !itemName)
				continue;
			
			skins.push({id: i, itemid: itemId, name: itemName});
		}
		for (var i = 10000; i < 10100; i++) {
			var itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( 5027, i );
			var itemName = InventoryAPI.GetItemName(itemId);

			if(itemName)
				itemName = itemName.split(' | ')[1];

			if(itemName == '' || itemName == undefined || !itemName)
				continue;
			
			gloves.push({id: i, itemid: itemId, name: itemName});
		}
		for (var i = 0; i < 200; i++) {
			var itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( 1314, i );
			var itemName = InventoryAPI.GetItemName(itemId);

			if(itemName)
				itemName = itemName.split(' | ')[1];

			if(itemName == '' || itemName == undefined || !itemName)
				continue;
			
			music.push({id: i, itemid: itemId, name: itemName});
		}
	}

	function _FillDropdown() {
		var weapon = $.GetContextPanel().FindChildInLayoutFile('Weapon').GetSelected().GetAttributeString( "value", "" );
		var slot = InventoryAPI.GetLoadoutCategory( InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( Number(weapon), 0 ) );
		
		if(['secondary', 'smg', 'rifle', 'heavy', 'c4', 'melee'].includes(slot))
			slot = 'weapon';

		if(latestWeaponSlot == slot)
			return;

		var items = undefined;

		switch (slot) {
			case 'clothing':
				items = gloves;
				break;
			case 'musickit':
				items = music;
				break;
			default:
				items = skins;
				break;
		}

		var elDropdown = $.GetContextPanel().FindChildInLayoutFile('Paint');
		elDropdown.ClearPanelEvent('oninputsubmit');
		elDropdown.RemoveAllOptions();
		elDropdown.RemoveAndDeleteChildren();

		var fieldEntry = $.CreatePanel('Label', elDropdown, "showfromfield", {
			class: 'DropDownMenu Width-250 White',
			value: 'showfromfield',
			text: 'Custom'
		});

		elDropdown.AddOption(fieldEntry);

		items.forEach(item => {
			var newEntry = $.CreatePanel('Label', elDropdown, "item"+item.id, {
				class: 'DropDownMenu Width-250 White',
				value: item.id,
				text: item.name+` (${item.id})`
			});

			elDropdown.AddOption(newEntry);
		});

		elDropdown.SetSelected( 'item'+items[0].id );
		elDropdown.SetPanelEvent('oninputsubmit', _UpdateWeaponPreview);

		latestWeaponSlot = slot;
	}

	function _OnWeaponDropdownChange()
	{
		_FillDropdown();
		_UpdateWeaponPreview();
	}

	function _UpdateWeaponPreview()
	{
		var elPanel = $.GetContextPanel().FindChildInLayoutFile('ItemPreview');
		elPanel.SetItemItemId('17293822569102705585', '');
        elPanel.SetItemItemId(_GetSelectedWeaponFauxItemId(), '');
	}

	function _GetSelectedPaintId()
	{
		var skinId = $.GetContextPanel().FindChildInLayoutFile('Paint').GetSelected().GetAttributeString( "value", "" );

		$.GetContextPanel().FindChildInLayoutFile('PaintFieldGroup').SetHasClass('hidden', skinId != 'showfromfield');

		if(skinId == 'showfromfield')
			skinId = $.GetContextPanel().FindChildInLayoutFile('PaintField').text;

		if(skinId == '')
			skinId = 2;

		return skinId;
	}

	function _GetSelectedWeaponFauxItemId()
	{
		var weapon = $.GetContextPanel().FindChildInLayoutFile('Weapon').GetSelected().GetAttributeString( "value", "" );
		var paint = _GetSelectedPaintId();
	
		return InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( Number(weapon), Number(paint) );
	}

	function _Inspect()
	{
		var itemId = _GetSelectedWeaponFauxItemId();
		const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + itemId, 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
        elPanel.Data().oSettings = {
            item_id: itemId,
            inspect_only: true,
            force_inspect_view_type: 'primary'
        };
	}

	function _CopyItemID()
	{
		SteamOverlayAPI.CopyTextToClipboard( _GetSelectedWeaponFauxItemId() );
	}

	return {
        Init: _Init,
        UpdateWeaponPreview: _UpdateWeaponPreview,
        CopyItemID: _CopyItemID,
        Inspect: _Inspect,
		OnWeaponDropdownChange: _OnWeaponDropdownChange
	};

})();