So i had a little demo with a user today and theres some serious shit we need to do in order to improve our app.

1. Each SKU needs to have it's own workflow settings. Workflow is no longer one-for-one-org. It's 1 for 1 SKU. So workflow changes for every sku.

2. For reworks, there's also a case where they don't necessarily go to a previous stage. It's possible that the item was totalled and of no use now. It will either be replaced with a new item (total quantity remains preserved) or it'll be totally removed from the workflow (meaning that the quantity will no longer be considered, we will have to reduce the overall quantity). IF REPLACED, THAT NEW ITEM will have to go through the whole workflow again. so in this case, if the qty of totalled items was 2, we will have to subtract 2 from the total count in the workflow and add 2 new items in new order items basically.

3. Need sub stages for sub stages, and sub stages for sub-sub-stages too.

4. A whole new feature of Keeping track of samples that a user has with them in their firm. All details related to samples like shape, color, engraving, etc.

5. A Vendors feature where all of the vendors that a user's firm works with are stored. Name, Firm Name of Vendor, GST, Address, Remarks (to keep comments about vendor).

6. Remove the Weight field from the items and sub-items. net weight and gross weight are good enough.

7. Standardize weight - default kg, option for pounds too. Standardize size - default inches, option for cm too.

8. A whole SKU management feature where user can see everything related to an SKU. 

9. Price at a stage linked with vendor and SKU. Eg: this vendor costs this much for this process for this SKU.

10. For the sub sub sub stages, it works like this basically" parent: Plating - Children - Copper , Nickel, Gold. Copper - All the vendors who do copper plating for how much price.

11. Now since every SKU has it's own workflow, and every stage / sub stage will have the vendor price associate with it, the user will also be shown the final calculated price that will be cost for an item that goes through that workflow. 

12. When an SKU has progressed through the whole workflowand has essentially been completed, we will keep that as a workflow template for the next time. Basically saving each SKU's workflow as now each SKU has it's own workflow settings.

Go through the app, and understand how things work currently, then plan how we're going to integrate these new things into our app. Lay out the detailed plan.
