'use strict';

var PopupGenerateItems = ( function()
{
    let items = [];

    function _Init()
	{
		for (let i = 0; i < 10000; i++) {
			var fauxItemId = InventoryAPI.GetFauxItemIDFromDefAndPaintIndex( i, 0 );
			var itemName = InventoryAPI.GetItemName(fauxItemId);

			if(itemName == '' || itemName == undefined || !itemName)
				continue;
			
			items.push({name: itemName, id: i, itemid: fauxItemId});
		}
        _CreatePanels();
	}

    function _CreatePanels() {
		var filter = $.GetContextPanel().FindChildInLayoutFile('itemsFilter').text.toLowerCase();

        var filteredItems = items.filter(item => {
            if (!filter) return true; 

            return item.name.toLowerCase().includes(filter);
        });

        var container = $.GetContextPanel().FindChildInLayoutFile('id-popup-items');
        container.RemoveAndDeleteChildren();

        filteredItems.forEach(item => {
            var elItem = $.CreatePanel("ItemImage", container, 'items' + item.id,
                {
                    itemid: item.itemid,
                    class: 'popup-tournament-select-spray-team'
                }
            );
        
            elItem.SetPanelEvent( 'onactivate', function()
            {
                var items = [
		        	{ label: 'Inspect', jsCallback: function() {
                        
                        if(ItemInfo.ItemHasCapability( item.itemid, 'decodable' ))
                            _ShowDecodePopup(item);
                        else
                            _ShowInspectPopup(item);

                    }.bind(undefined) },
		        	{ label: 'Copy ItemId', jsCallback: function() {
                        SteamOverlayAPI.CopyTextToClipboard( item.itemid );
                    }.bind(undefined) },
		        	{ label: 'Copy ItemSchema', jsCallback: function() {
                        SteamOverlayAPI.CopyTextToClipboard( InventoryAPI.BuildItemSchemaDefJSON( item.itemid ) );
                    }.bind(undefined) }
		        ];
            
    	        UiToolkitAPI.ShowSimpleContextMenu( '', 'ItemContextMenu', items );
            }.bind( undefined ) );
        
            elItem.SetPanelEvent( 'onmouseover', function()
            {
                UiToolkitAPI.ShowCustomLayoutParametersTooltip('items' + item.id, 'JsItemTooltip', 'file://{resources}/layout/tooltips/tooltip_inventory_item.xml', 'itemid=' + item.itemid);
            }.bind( undefined ) );
        
		    elItem.SetPanelEvent( 'onmouseout', function()
		    {
                UiToolkitAPI.HideCustomLayoutTooltip('JsItemTooltip');
		    	UiToolkitAPI.HideTextTooltip();
		    } );
        });
        
    }

    function _ShowDecodePopup(item) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + item.itemid, 'file://{resources}/layout/popups/popup_capability_decodable.xml');
        elPanel.Data().oSettings = {
            item_id: item.itemid,
            work_type: 'decodeable'
        };
    }

    function _ShowInspectPopup(item) {
        const elPanel = UiToolkitAPI.ShowCustomLayoutPopup('popup-inspect-' + item.itemid, 'file://{resources}/layout/popups/popup_inventory_inspect.xml');
        elPanel.Data().oSettings = {
            item_id: item.itemid,
            inspect_only: true,
            force_inspect_view_type: 'primary'
        };
    }
 
	return {
        Init: _Init,
        CreatePanels: _CreatePanels
	};

})();