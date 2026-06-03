'use strict';

var PopupGenerator = ( function(){

	function UpdateWeaponSkinPreview()
	{
		var weaponIdx = $.GetContextPanel().FindChildInLayoutFile('itemIdx').GetSelected().GetAttributeString( "value", "" );
        var skinIdx = $.GetContextPanel().FindChildInLayoutFile('skinIdx').text;

		var itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( parseInt(weaponIdx), parseInt(skinIdx) );

        var elPanel = $('#ItemPreview');
        elPanel.SetItemItemId('17293822569102705585', '');
        elPanel.SetItemItemId(itemId, '');
	}

	function UpdateWeaponItemPreview()
	{
		var weaponIdx = $.GetContextPanel().FindChildInLayoutFile('itemIdx').GetSelected().GetAttributeString( "value", "" );

		var itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( parseInt(weaponIdx), 0 );

        var elPanel = $('#ItemPreview');
        elPanel.SetItemItemId(itemId, '');
	}

	function CopyActiveItemID(asd)
	{
		var weaponIdx = $.GetContextPanel().FindChildInLayoutFile('itemIdx').GetSelected().GetAttributeString( "value", "" );
        var skinIdx = asd == true ? $.GetContextPanel().FindChildInLayoutFile('skinIdx').text : 0;

		var itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( parseInt(weaponIdx), parseInt(skinIdx) );
		SteamOverlayAPI.CopyTextToClipboard(itemId);
	}

	function InspectItem(asd)
	{
		var weaponIdx = $.GetContextPanel().FindChildInLayoutFile('itemIdx').GetSelected().GetAttributeString( "value", "" );
        var skinIdx = asd == true ? $.GetContextPanel().FindChildInLayoutFile('skinIdx').text : 0;

		var itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( parseInt(weaponIdx), parseInt(skinIdx) );

		if(ItemInfo.ItemHasCapability(itemId, 'decodable')) {
			const elPanel = UiToolkitAPI.ShowCustomLayoutPopupParameters('popup-inspect-' + itemId, 'file://{resources}/layout/popups/popup_capability_decodable.xml', 'key-and-case=,' + itemId +
                '&' + 'asyncworktype=decodeable');
            let oSettings = {
                item_id: itemId,
                work_type: 'decodeable'
            };
            elPanel.Data().oSettings = oSettings;
			return;
		}

		const elPanel = UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_inventory_inspect.xml', `itemid=${itemId}&inspectonly=true&viewfunc=primary`);
        let oSettings = {
            item_id: itemId,
            inspect_only: true,
            force_inspect_view_type: 'primary'
        };
        elPanel.Data().oSettings = oSettings;
	}

	function FillItems()
	{
		for (let i = 0; i < 12500; i++) {
			var itemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( i, 0 );
			var itemName = InventoryAPI.GetItemName(itemId);

			if(itemName == '' || itemName == undefined || !itemName)
				continue;
			
			var elDropdown = $.GetContextPanel().FindChildInLayoutFile('itemIdx');
			var newEntry = $.CreatePanel('Label', elDropdown, "item"+i, {
					class: 'DropDownMenu Width-250 White',
					value: i,
					text: itemName
				});

			elDropdown.AddOption(newEntry);
		}
		elDropdown.SetSelected( 'item1' );
	}

	return {
		InspectItem:	InspectItem,
		CopyActiveItemID:	CopyActiveItemID,
        UpdateWeaponSkinPreview: UpdateWeaponSkinPreview,
		UpdateWeaponItemPreview: UpdateWeaponItemPreview,
		FillItems: FillItems
	};

})();