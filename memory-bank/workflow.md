# Trackure V1 - Default Workflow Structure

_(Sequence Order indicates the typical flow. Gaps are left for easier insertion of custom steps later.)_

---

## Main Stages (`workflow_stages` table)

| name               | sequence_order | is_default |
| :----------------- | :------------- | :--------- |
| Order Intake       | 10             | true       |
| Manufacturing      | 20             | true       |
| Customization      | 30             | true       |
| Finishing          | 40             | true       |
| Packaging          | 50             | true       |
| Ready for Dispatch | 60             | true       |

---

## Sub-stages (`workflow_sub_stages` table)

_(Link these to the appropriate `stage_id` from the `workflow_stages` table)_

### Linked to Manufacturing Stage (Sequence: 20)

| name                  | sequence_order | is_default | Description (Optional Use)             |
| :-------------------- | :------------- | :--------- | :------------------------------------- |
| Material Preparation  | 10             | true       | Cutting, shaping raw materials         |
| Casting / Molding     | 20             | true       | Initial forming of the item            |
| Machining / Milling   | 30             | true       | Precision shaping or drilling          |
| Component Assembly    | 40             | true       | Joining initial parts                  |
| Welding / Joining     | 50             | true       | Permanent joining methods              |
| Deburring / Smoothing | 60             | true       | Removing rough edges                   |
| Structural Check      | 70             | true       | Initial check for basic form/integrity |

### Linked to Customization Stage (Sequence: 30)

| name                   | sequence_order | is_default | Description (Optional Use)                       |
| :--------------------- | :------------- | :--------- | :----------------------------------------------- |
| Surface Prep           | 10             | true       | Cleaning/preparing for customization             |
| Fine Polishing         | 20             | true       | Achieving high shine                             |
| Brushing / Graining    | 30             | true       | Creating specific surface textures               |
| Laser Engraving        | 40             | true       | Precise marking or design application            |
| Hand Engraving         | 50             | true       | Manual detailed work                             |
| Stone Setting (If Any) | 60             | true       | Adding gems or decorative elements               |
| Plating / Coating      | 70             | true       | Applying final surface layer (gold, rhodium etc) |
| Customization Verify   | 80             | true       | Check if customization matches specs             |

### Linked to Finishing Stage (Sequence: 40)

| name                             | sequence_order | is_default | Description (Optional Use)            |
| :------------------------------- | :------------- | :--------- | :------------------------------------ |
| Post-Customization Clean         | 10             | true       | Removing residues from previous stage |
| Matte / Satin Finish Application | 20             | true       | Applying non-gloss finishes           |
| Protective Coating (Optional)    | 30             | true       | Lacquer or anti-tarnish layer         |
| Final Polish / Buffing           | 40             | true       | Final touch-up for appearance         |
| Dimensional Check                | 50             | true       | Verifying final size/shape            |
| Functional Check (If Any)        | 60             | true       | Testing moving parts, clasps etc.     |
| Aesthetic Final Inspection       | 70             | true       | Overall look and feel assessment      |

### Linked to Packaging Stage (Sequence: 50)

| name                         | sequence_order | is_default | Description (Optional Use)                    |
| :--------------------------- | :------------- | :--------- | :-------------------------------------------- |
| Verify Packaging Materials   | 10             | true       | Ensuring correct boxes, inserts are available |
| Individual Item Wrapping     | 20             | true       | Protective wrap (tissue, polybag)             |
| Placement in Primary Box     | 30             | true       | Placing item in velvet box, gift box etc.     |
| Adding Inserts/Padding       | 40             | true       | Securing item within primary box              |
| Labeling Primary Box         | 50             | true       | SKU, barcode, or item identifier label        |
| Packing into Shipping Carton | 60             | true       | Grouping primary boxes into outer carton      |
| Adding Dunnage               | 70             | true       | Filling voids in shipping carton              |
| Sealing Shipping Carton      | 80             | true       | Taping and securing the outer box             |
| Final Weight/Dimension Check | 90             | true       | Recording final shipping metrics              |
| Applying Shipping Labels     | 100            | true       | Address labels, customs declarations etc.     |

---

### Stages without Default Sub-stages

- Order Intake (Sequence: 10)
- Ready for Dispatch (Sequence: 60)

---
