/*
 * All graph content lives here. Edit this file to change the map; app.js only draws it.
 *
 * Position is (stage, sub, lane): stage = time column, sub = step order inside the stage, lane = who/what row.
 * Node types: trigger | action | doc | decision | external | gap | auto | approve | store
 * Manual nodes list `automations` (ids from docs/automation-suggestions.md) and `pains` (Q ids).
 * Automated nodes list `replaces` (manual node ids) - the two sides are cross-linked from that one field.
 * `assumed: true` = not shown in any client file; drawn dashed and flagged in the panel.
 */
(function () {
  var stages = [
    { id: 0, label: 'Order intake' },
    { id: 1, label: 'Release & planning' },
    { id: 2, label: 'Procurement' },
    { id: 3, label: 'Inward & QC' },
    { id: 4, label: 'Production' },
    { id: 5, label: 'Packing & dispatch' },
    { id: 6, label: 'Review' }
  ];

  var lanes = [
    'Customer & external parties', 'Sales & order desk', 'Engineering & master data', 'Purchase',
    'Stores & inward', 'Production (shop floor)', 'Maintenance', 'Management, planning & accounts',
    'Docs / system of record', 'Screens & portals'
  ];

  var pains = {
    Q1: 'Hand-typed status contradicts the numbers', Q2: 'Price lookup key broken (PRICE NOT FOUND)',
    Q3: 'Costing SUM range skips an operation', Q4: 'Divergent copies of one costing', Q5: 'Wrong skill rate on an operation',
    Q6: 'Rate list polluted with item codes', Q7: 'Stock floored at 0 / negative carry-forward', Q8: 'Production never booked to stock',
    Q9: 'GST / HSN inconsistent', Q10: 'Impossible dates', Q11: 'Over-receipt with no tolerance rule',
    Q12: 'KPI formula disagrees with itself', Q13: 'Master data incomplete / inconsistent', Q14: 'Duration typed as text',
    Q15: 'Breakdown logged days after repair', Q16: 'Material naming drift', Q17: 'Live formula errors (#VALUE!, #REF!)'
  };

  var automations = {
    A1: 'Order release to production bucket, auto-schedule', A2: 'Auto-allocate dispatches to open PO lines', A3: 'Auto order status + dispatch-ready list',
    A4: 'Capable-to-promise delivery date', A5: 'Order validation (HSN to GST, dates, duplicates)', A6: 'FX rate fetch + lock', A7: 'Customer notifications',
    A8: 'Short-close / balance clean-up', A9: 'PO intake from WhatsApp / email / portal', B1: 'Vendor PO follow-up + escalation', B2: 'Over-receipt tolerance + vendor email', B3: 'Promised-date capture',
    B4: 'Vendor scorecards', B5: 'Casting / RM requirement planning (MRP-lite)', B6: 'Casting rate watch', B7: 'Purchase approval workflow',
    B8: 'Material-ready date gates job release', C1: 'Single ledger with derived stock', C2: 'Shop-floor production booking', C4: 'BOM explosion, auto-consume children',
    C5: 'Weight-variance alerts', C8: 'QR labels + scan transactions', D1: 'Job-work reconciliation', D2: 'Auto challan PDF + ITC-04 data',
    D3: 'Reject to vendor: auto debit note', D4: 'E-way bill / e-invoice JSON', E1: 'Item-code + MPN generator', E2: 'Duplicate / cross-reference detection',
    E3: 'HSN to GST auto-fill', E4: 'Controlled vocabularies', E5: 'Contains text to structured BOM', E6: 'New product: draft costing + routing',
    F1: 'Costing engine from one routing + rate master', F2: 'True machine-hour rate', F3: 'Margin monitor per order line', F4: 'Price-revision engine',
    G1: 'Real-time breakdown ticket to machine DOWN', G2: 'MTTR / MTBF dashboard', G3: 'Preventive-maintenance plan', G4: 'Maintenance spares register',
    G5: 'Warranty / AMC alerts', H1: 'Machine capability matrix', H2: 'Asset register validation', I1: 'Costing-sheet routings imported to PPC',
    I2: 'Digital job card with QR', I3: 'In-process QC + heat-code traceability', J1: 'Daily MIS digest', J2: 'Data-health watchdog', J3: 'Role-based access + audit trail'
  };

  var nodes = [], edges = [];
  function node(sec, id, stage, sub, lane, type, label, o) {
    var n = { id: id, section: sec, stage: stage, sub: sub, lane: lane, type: type, label: label };
    for (var k in o) n[k] = o[k];
    nodes.push(n);
  }
  function M(id, stage, sub, lane, type, label, o) { node('manual', id, stage, sub, lane, type, label, o || {}); }
  function A(id, stage, sub, lane, type, label, o) { node('auto', id, stage, sub, lane, type, label, o || {}); }
  function E(from, to, o) {
    var e = { from: from, to: to, id: from + '>' + to + (edges.some(function (x) { return x.from === from && x.to === to; }) ? '#2' : '') };
    for (var k in (o || {})) e[k] = o[k];
    edges.push(e);
  }
  var Y = { label: 'Yes' }, N = { label: 'No' };
  function y(extra) { var o = { label: 'Yes' }; for (var k in extra) o[k] = extra[k]; return o; }
  function n(extra) { var o = { label: 'No' }; for (var k in extra) o[k] = extra[k]; return o; }
  function loop(label, extra) { var o = { kind: 'loop', label: label }; for (var k in extra) o[k] = extra[k]; return o; }

  /* =====================================================================
   *  MANUAL (current state)
   * ===================================================================== */

  /* ---- 1 Order intake ---- */
  M('m_po', 0, 0, 0, 'external', 'Customer sends PO', { actor: 'Customer (AMNJ, AMON, AM-AB, MNS-1..7, SHR, GRAB ...)', summary: 'Export and domestic customers place purchase orders. The channel (email, WhatsApp, phone) is not visible in the shared files; the order is re-typed from whatever arrived.', evidence: 'erp/image (1).png (ORDERS tab)' });
  M('m_review', 0, 1, 1, 'action', 'Sales reviews PO', { actor: 'Sales', summary: 'Someone reads the customer\'s message or email, checks quantities, dates and price, then types the order in. No checklist or system support is visible.', assumed: true, automations: ['A9'] });
  M('m_inmaster', 0, 2, 1, 'decision', 'Item in product master?', { actor: 'Sales', summary: 'Sales looks the item up in the product master by eye. New customer parts are common (many OE numbers per mark).', evidence: 'product-master/image (2).png' });
  M('m_prodform', 0, 2, 2, 'doc', 'Fill new-product form', { actor: 'Engineering', summary: 'Product code, OE no., MPN, HS code, GST, weights, material, finish and "Contains" are typed by hand. The MPN is chosen by checking the last number used for AM and MNS.', touch: { verb: 'add', doc: 's_prodmaster', fields: ['Product code & OE no.', 'MPN (check last MPN by hand)', 'HS code, GST rate', 'Casting / net / gross weight', 'Material, finish', 'Contains (Child*Qty text)'] }, pains: ['Q9', 'Q13', 'Q16'], automations: ['E1', 'E2', 'E3', 'E4', 'E5'], evidence: 'product-master/image (1).png' });
  M('m_typepo', 0, 3, 1, 'doc', 'Type PO line into ORDERS', { actor: 'Sales / order desk', summary: 'Every PO line is re-typed into the ORDERS tab. Dates and HSN/GST are free text, so typos pass through.', touch: { verb: 'add', doc: 's_orders', fields: ['PO no. + date', 'Item code, qty, required date', 'Mark, HSN, GST %', 'Selling price'] }, pains: ['Q9', 'Q10'], automations: ['A5', 'A9'], evidence: 'erp/image (1).png' });
  M('m_export', 0, 4, 1, 'decision', 'Export order?', { actor: 'Sales', summary: 'US and Canada orders carry a currency, an FX rate and a lock date.', evidence: 'erp/image (1).png (Currency, FX Rate, Lock Date)' });
  M('m_fx', 0, 4, 7, 'doc', 'Type FX rate + lock date', { actor: 'Sales / accounts', summary: 'Currency, FX rate (e.g. 88.2163) and lock date are keyed by hand. One row shows "LOCKED FROM LEGACY USD VALUE".', touch: { verb: 'edit', doc: 's_orders', fields: ['Currency', 'FX rate', 'Lock date', 'Status'] }, automations: ['A6'], evidence: 'erp/image (1).png' });
  M('m_pricechk', 0, 5, 1, 'decision', 'Price differs from last PO?', { actor: 'Sales', summary: 'Price is compared with earlier orders through the COP price key and COP HISTORY tab. What COP stands for is still an open question.', assumed: true, evidence: 'erp/image (7).png (price history)' });
  M('m_cop', 0, 5, 7, 'doc', 'Edit COP / COP HISTORY', { actor: 'Sales / accounts', summary: 'Price history is maintained in a separate tab by hand.', touch: { verb: 'update', doc: 's_orders', fields: ['COP price key', 'Price history row'] }, pains: ['Q2'], automations: ['F3'], assumed: true });
  M('s_prodmaster', 0, 2, 8, 'store', 'Product master (form + table)', { actor: 'Google Form + sheet', summary: 'One row per product, filled through a Google Form.', evidence: 'product-master/image (2).png' });
  M('s_orders', 0, 3, 8, 'store', 'ORDERS tab', { actor: 'Google Sheet', summary: 'Customer PO lines with "Tick for mfg", hand-typed stock/projected date, dispatch invoice refs and balance.', evidence: 'erp/image (1).png' });

  E('m_po', 'm_review');
  E('m_review', 'm_inmaster');
  E('m_inmaster', 'm_prodform', n({ condition: 'Item code not found', handoff: 'Customer part number, drawing' }));
  E('m_inmaster', 'm_typepo', y({ condition: 'Item exists' }));
  E('m_prodform', 'm_typepo', { label: 'Item created', handoff: 'New product code' });
  E('m_typepo', 'm_export');
  E('m_export', 'm_fx', y());
  E('m_export', 'm_pricechk', n());
  E('m_fx', 'm_pricechk');
  E('m_pricechk', 'm_cop', y());
  E('m_pricechk', 'm_ready', n());
  E('m_cop', 'm_ready');

  /* ---- 2 Release & planning ---- */
  M('m_ready', 1, 0, 1, 'decision', 'Ready stock covers order?', { actor: 'Sales / stores', summary: 'Someone reads net stock in ORDERS or the Item query sheet. Stock is floored at 0 and finished production is never booked, so the answer is often wrong.', reads: ['s_orders', 's_itemq'], pains: ['Q7', 'Q8'], automations: ['A3', 'C1'], evidence: 'product-master/image (4).png' });
  M('m_tick', 1, 1, 1, 'doc', 'Tick "Tick for mfg"', { actor: 'Sales / order desk', summary: 'A checkbox on the ORDERS line is the only release-to-production signal.', touch: { verb: 'update', doc: 's_orders', fields: ['Tick for mfg checkbox'] }, automations: ['A1'], evidence: 'erp/image (1).png' });
  M('m_verbal', 1, 2, 5, 'action', 'Pick machines verbally', { actor: 'Production head', summary: 'Machine and sequence are chosen from experience. No schedule document exists in the shared files.', assumed: true, automations: ['A1'] });
  M('m_stockdate', 1, 2, 1, 'doc', 'Type stock / projected date', { actor: 'Sales / order desk', summary: 'Free text such as "IN STOCK", "CASTING ORDERED", "DIE MOVE TO ATAM VALVE". Not computed from anything.', touch: { verb: 'edit', doc: 's_orders', fields: ['Stock / Projected Date (free text)'] }, pains: ['Q1'], automations: ['A3', 'A4'], evidence: 'erp/image (1).png' });
  M('m_gap_sched', 1, 3, 5, 'gap', 'No schedule, no computed ETA', { actor: 'Nobody', summary: 'Nothing records what runs on which machine or when it will finish, so "when do I get item N" has no answer.', automations: ['A1'] });
  M('m_castok', 1, 3, 4, 'decision', 'Casting / RM in stock?', { actor: 'Stores', summary: 'Checked against the stock summary, which does not include finished production or machine WIP.', reads: ['s_itemq'], pains: ['Q7'], automations: ['B8', 'C1'], evidence: 'product-master/image (4).png' });
  M('s_itemq', 1, 1, 8, 'store', 'Item query sheet', { actor: 'Google Sheet (read-only report)', summary: 'Item 360 view: stock, pending orders, inward/outward windows, last-10 ledger. Has #DIV/0! and #VALUE! errors.', pains: ['Q17'], evidence: 'erp/image (4).png' });

  E('m_ready', 'm_tick', n({ condition: 'Stock short or partly short' }));
  E('m_ready', 'm_ready2', y({ condition: 'Stock covers the order', note: 'Skips production and goes straight to dispatch.' }));
  E('m_tick', 'm_verbal', { handoff: 'Verbal instruction' });
  E('m_tick', 'm_stockdate');
  E('m_verbal', 'm_gap_sched', { label: 'Nothing recorded' });
  E('m_stockdate', 'm_castok');
  E('m_castok', 'm_buydec', n({ condition: 'No castings on hand' }));
  E('m_castok', 'm_issue', y({ condition: 'Castings on hand' }));

  /* ---- 3 Procurement ---- */
  M('m_buydec', 2, 0, 3, 'action', 'Decide what to order', { actor: 'Purchase', summary: 'Quantities come from order notes ("Check Ingredients", "casting need by 25/6/26") and memory. No net-requirement calculation.', assumed: true, automations: ['B5'] });
  M('m_okapp', 2, 0, 7, 'doc', 'Type "ok" once approved', { actor: 'Purchase / EA', summary: 'Approval is the text "ok" typed into a sheet column.', touch: { verb: 'edit', doc: 's_invpur', fields: ['Approval column (text "ok")'] }, automations: ['B7'], evidence: 'erp/image (1) (1).png' });
  M('m_pologged', 2, 1, 3, 'doc', 'Log PO in PO tracker', { actor: 'Purchase', summary: 'PO no. (PO/BA/26xx/nnn), vendor, qty, rate per kg and remarks such as "Heat code is must" are entered by hand. No vendor-promised date is captured.', touch: { verb: 'add', doc: 's_po', fields: ['PO date, PO no.', 'Item, vendor, qty', 'Rate per kg', 'Remarks (heat code, need-by)'] }, automations: ['B3'], evidence: 'erp/image (2).png' });
  M('m_wait', 2, 2, 3, 'action', 'Wait: delay = today - PO date', { actor: 'Purchase', summary: 'The tracker counts days since the PO date, not days past a promise. Delay reaches 368, 333 and 285 days on some lines.', automations: ['B3'], evidence: 'erp/image (2).png' });
  M('m_overdue', 2, 3, 3, 'decision', 'PO overdue? (eyeball red cell)', { actor: 'Purchase', summary: 'Purchase notices the red delay cells when it happens to look. No reminder is scheduled.', automations: ['B1'], evidence: 'erp/image (2).png' });
  M('m_chase', 2, 4, 3, 'action', 'Phone / email vendor chase', { actor: 'Purchase', summary: 'Chasing is manual and ad hoc. Emails are sent only when a receipt exceeds the PO.', automations: ['B1'] });
  M('s_po', 2, 1, 8, 'store', 'PO tracker', { actor: 'Google Sheet', summary: 'Vendor POs with qty ordered/received, pending, status, delay days and rate.', pains: ['Q11'], evidence: 'erp/image (2).png' });

  E('m_buydec', 'm_okapp');
  E('m_okapp', 'm_pologged', { label: 'Approved' });
  E('m_pologged', 'm_wait', { handoff: 'PO to foundry (phone / email)' });
  E('m_wait', 'm_overdue');
  E('m_overdue', 'm_chase', y({ condition: 'Red delay cell noticed' }));
  E('m_overdue', 'm_ship', n({ condition: 'Not noticed, or on time', note: 'Delivery time is open-ended: average fulfilment 31.8 days, maximum 80 (vendor report).' }));
  E('m_chase', 'm_wait', loop('Keep waiting'));

  /* ---- 4 Inward & QC ---- */
  M('m_ship', 3, 0, 0, 'external', 'Foundry ships castings + challan', { actor: 'Foundry (J.k castings, Kent Malleables, KR INDS, Bedi Exports ...)', summary: 'Castings arrive with the vendor challan, often in several part-shipments.', evidence: 'erp/image (6).png (vendor report)' });
  M('m_recv', 3, 1, 4, 'action', 'Receive + weigh', { actor: 'Stores', summary: 'Goods are received and weighed. Recorded weight is compared with the average weight only by eye.', automations: ['C8'] });
  M('m_inward', 3, 2, 4, 'doc', 'Enter inward in INV/PUR', { actor: 'Stores (RM inward clerk)', summary: 'Date, item, qty, party, recorded weight and doc reference are typed into the ledger. Total weight shows 0 on inward rows.', touch: { verb: 'add', doc: 's_invpur', fields: ['Date', 'Item, qty, party', 'Recorded weight', 'Doc reference'] }, pains: ['Q10', 'Q13'], automations: ['C1', 'C8'], evidence: 'erp/image (1) (1).png' });
  M('m_qtychk', 3, 3, 4, 'decision', 'Qty > PO qty?', { actor: 'Stores / purchase', summary: 'A formula flags "INWARD EXCEEDS ORDER" or "QTY EXCEEDS PO". There is no tolerance rule: 1,100 became 1,144 and 200 became 219.', pains: ['Q11'], automations: ['B2'], evidence: 'erp/image (2).png' });
  M('m_overmail', 3, 3, 3, 'action', 'Email vendor by hand', { actor: 'Purchase', summary: 'Over-receipts are emailed one by one after somebody spots the cyan flag.', pains: ['Q11'], automations: ['B2'] });
  M('m_qual', 3, 4, 4, 'decision', 'Weight / quality OK?', { actor: 'Stores', summary: 'Judged visually and by weight. Recorded weight vs list weight differ (e.g. 29.775 vs 28.96 kg).', automations: ['C5'], evidence: 'erp/image.png' });
  M('m_rej', 3, 5, 4, 'doc', 'Prepare reject challan', { actor: 'Stores', summary: 'A delivery challan is laid out in a sheet, valued per kg. On the sample, party GSTIN and address were blank.', touch: { verb: 'add', doc: 's_challan', fields: ['Party', 'Items + qty', 'Weights, rate per kg', 'Vehicle no., time of removal'] }, pains: ['Q13'], automations: ['D2', 'D3'], evidence: 'erp/image (3).png' });
  M('m_upd', 3, 5, 3, 'doc', 'Update qty received in PO tracker', { actor: 'Purchase', summary: 'Received quantity is re-typed against the PO line.', touch: { verb: 'update', doc: 's_po', fields: ['Qty received', 'Last inward date'] }, automations: ['C1'], evidence: 'erp/image (2).png' });
  M('m_foundry_rej', 3, 6, 0, 'external', 'Foundry receives rejects', { actor: 'Foundry', summary: 'Rejected castings go back on the challan. Replacement timing is not tracked.' });
  M('m_pofull', 3, 6, 3, 'decision', 'PO fully received?', { actor: 'Purchase', summary: 'Compared by eye against pending qty.', automations: ['C1'] });
  M('s_invpur', 3, 2, 8, 'store', 'INV/PUR tab', { actor: 'Google Sheet (~8,000 rows since 2018)', summary: 'All inward, outward, job challans, rejects and scrap in one ledger. Every visible row shows PRICE NOT FOUND.', pains: ['Q2', 'Q17'], evidence: 'erp/image (1) (1).png' });
  M('s_challan', 3, 5, 8, 'store', 'Challan sheet', { actor: 'Google Sheet', summary: 'Printable delivery / job challan layout.', evidence: 'erp/image (3).png' });

  E('m_ship', 'm_recv');
  E('m_recv', 'm_inward');
  E('m_inward', 'm_qtychk');
  E('m_qtychk', 'm_overmail', y({ condition: 'Received > ordered' }));
  E('m_qtychk', 'm_qual', n());
  E('m_overmail', 'm_qual');
  E('m_qual', 'm_rej', n({ condition: 'Weight or quality off' }));
  E('m_qual', 'm_upd', y({ condition: 'Accepted' }));
  E('m_rej', 'm_foundry_rej', { handoff: 'Reject challan + castings' });
  E('m_foundry_rej', 'm_wait', loop('Replacement due', { note: 'Nothing tracks when the replacement is promised.' }));
  E('m_upd', 'm_pofull');
  E('m_pofull', 'm_wait', n({ kind: 'loop', condition: 'Part shipment', note: 'Balance stays open on the PO line.' }));
  E('m_pofull', 'm_issue', y({ condition: 'Castings ready for machining' }));

  /* ---- 5 Production + maintenance ---- */
  M('m_issue', 4, 0, 5, 'action', 'Issue casting to machine', { actor: 'Production', summary: 'Castings move to the shop floor with no recorded issue.', automations: ['I2'] });
  M('m_mach', 4, 1, 5, 'action', 'Machining (lathe, CNC, VMC, HMC, 5-axis, VTL)', { actor: 'Operator', summary: 'Machine is picked from what is free. Eight lathes, seven drills, two CNC turning, two VMC, two HMC, one 5-axis, two VMM, one VTL are on the register.', automations: ['A1', 'C2'], evidence: 'product-master/Machinery_Equipment Master.xlsx' });
  M('m_jwq', 4, 2, 5, 'decision', 'External job work needed?', { actor: 'Production', summary: 'Operations such as shot blasting go to outside job workers.', evidence: 'erp/image.png' });
  M('m_jwout', 4, 3, 4, 'doc', 'Job challan out', { actor: 'Stores', summary: 'Lots (60 to 125 pcs) are sent out on a job challan and entered in the ledger.', touch: { verb: 'add', doc: 's_invpur', fields: ['Job challan out', 'Item, qty, weight', 'Party'] }, automations: ['D1', 'D2'], evidence: 'erp/image.png' });
  M('m_jw', 4, 4, 0, 'external', 'Job worker processes', { actor: 'Job worker (RESHAM SHOT BLAST, Rurka Sales Corp ...)', summary: 'Returns come back in different lot sizes than they went out (e.g. 260, 302).', evidence: 'erp/image.png' });
  M('m_jwin', 4, 5, 4, 'doc', 'Job challan inward entry', { actor: 'Stores', summary: 'Returned lots are entered on a second line.', touch: { verb: 'add', doc: 's_invpur', fields: ['Job challan inward', 'Item, qty', 'Party'] }, automations: ['D1'], evidence: 'erp/image.png' });
  M('m_tally', 4, 6, 4, 'decision', 'Qty / weight tally?', { actor: 'Stores', summary: 'No automatic comparison between sent and returned.', automations: ['D1'] });
  M('m_rec', 4, 7, 4, 'action', 'Reconcile by hand', { actor: 'Stores', summary: '"Net pending with JW" is derived by hand in the Item query sheet.', reads: ['s_itemq'], automations: ['D1'], evidence: 'erp/image (4).png' });
  M('m_finish', 4, 7, 5, 'action', 'Drill / tap / paint', { actor: 'Operator / paint section', summary: 'Paint section: M-seal, Regmark, dip in black glossy, oven. Steps and times exist only in each item\'s costing sheet.', automations: ['I1', 'I2'], evidence: 'product-master/Cost MV9650.xlsx' });
  M('m_insp', 4, 8, 5, 'decision', 'Inspection pass?', { actor: 'Inspector', summary: 'Gauge and control spec are written in the costing sheet, but results are not recorded.', automations: ['I3'], evidence: 'product-master/Cost MV9650.xlsx' });
  M('m_scrap', 4, 8, 4, 'doc', 'Record reject / scrap', { actor: 'Stores', summary: 'Rejects and scrap are entered in INV/PUR with status "Reject" or "Scrap".', touch: { verb: 'add', doc: 's_invpur', fields: ['Status (Reject / Scrap)', 'Item, qty', 'Weight'] }, automations: ['C2'], evidence: 'erp/image.png' });
  M('m_gapfg', 4, 9, 5, 'gap', 'Completion not booked to stock', { actor: 'Nobody', summary: 'Good pieces are never entered. M1751 shows 28,722 pcs outward against 6 inward; "Production to packing, last 60 days" is 0.', pains: ['Q8'], automations: ['C2', 'C4'], evidence: 'product-master/image (4).png, erp/image (4).png' });

  M('m_brk', 4, 1, 6, 'trigger', 'Machine breaks down', { actor: 'Machine', summary: '19 breakdowns logged May to Sep 2026: 446 h of downtime, Rs 79,684 repair cost.', automations: ['G1'], evidence: 'product-master/Breakdown Report.xlsx' });
  M('m_verbalbrk', 4, 2, 6, 'action', 'Operator tells supervisor', { actor: 'Operator', summary: 'Reporting is verbal. No ticket exists while the machine is down.', assumed: true, automations: ['G1'] });
  M('m_repair', 4, 3, 6, 'action', 'Maintenance / vendor repairs', { actor: 'Maintenance', summary: 'Typical repairs: APC battery (4 times), belts, coolant filter, bearings. Advice such as "check the chain every two months" is not turned into a plan.', automations: ['G1', 'G3'], evidence: 'product-master/Breakdown Report.xlsx' });
  M('m_brkform', 4, 4, 6, 'doc', 'Fill breakdown form after repair', { actor: 'Maintenance supervisor', summary: 'A Google Form is filled after the fact: up to 10 days after repair (DM006). Downtime is typed as text ("1 Day 23 Hours 11 Minutes").', touch: { verb: 'add', doc: 's_brk', fields: ['Machine id', 'Date + time of breakdown', 'Details, action taken', 'Repaired date/time', 'Total time (typed text)', 'Cost, remarks'] }, pains: ['Q14', 'Q15'], automations: ['G1', 'G2'], evidence: 'product-master/Breakdown Report.xlsx' });
  M('m_gapdown', 4, 5, 6, 'gap', 'Planner never told machine is down', { actor: 'Nobody', summary: 'Downtime never reaches production planning, so jobs queue on a dead machine.', automations: ['G1', 'H1'] });
  M('m_newmach', 4, 6, 6, 'trigger', 'New machine installed', { actor: 'Maintenance', summary: 'A new asset arrives and has to be recorded.' });
  M('m_mm', 4, 7, 6, 'doc', 'Fill machine-master form', { actor: 'Maintenance / admin', summary: 'The "Operations" field is copy-pasted ("Drilling, Turning, Milling" on drills and angle grinders); cost is often the placeholder 1; warranty and spares mostly blank.', touch: { verb: 'add', doc: 's_mm', fields: ['Machine id, name, kind, make', 'Year / installation date', 'Cost', 'Operations (picklist missing)', 'Warranty, spares'] }, pains: ['Q13'], automations: ['H1', 'H2'], evidence: 'product-master/Machinery_Equipment Master.xlsx' });
  M('s_brk', 4, 4, 8, 'store', 'Breakdown form (Google Form)', { actor: 'Google Form', summary: '19 rows May to Sep 2026.', evidence: 'product-master/Breakdown Report.xlsx' });
  M('s_mm', 4, 7, 8, 'store', 'Machine master form', { actor: 'Google Form', summary: '36 assets: 8 lathes, 7 drills, CNC, VMC, HMC, 5-axis, VMM, VTL, grinders, compressors, dryers.', evidence: 'product-master/Machinery_Equipment Master.xlsx' });

  E('m_issue', 'm_mach');
  E('m_mach', 'm_jwq');
  E('m_jwq', 'm_jwout', y({ condition: 'Operation done outside' }));
  E('m_jwq', 'm_finish', n({ condition: 'All operations in-house' }));
  E('m_jwout', 'm_jw', { handoff: 'Job challan + parts' });
  E('m_jw', 'm_jwin', { handoff: 'Processed parts' });
  E('m_jwin', 'm_tally');
  E('m_tally', 'm_finish', y());
  E('m_tally', 'm_rec', n({ condition: 'Mismatch' }));
  E('m_rec', 'm_finish');
  E('m_finish', 'm_insp');
  E('m_insp', 'm_scrap', n({ condition: 'Fails gauge / spec' }));
  E('m_insp', 'm_gapfg', y({ condition: 'Passes' }));
  E('m_scrap', 'm_mach', loop('Rework'));
  E('m_gapfg', 'm_ready2', { label: 'Stock not updated', note: 'Dispatch depends on a stock figure that does not include this production.' });

  E('m_brk', 'm_verbalbrk');
  E('m_verbalbrk', 'm_repair');
  E('m_repair', 'm_brkform', { label: 'Days later', note: 'Logged between 0 and 10 days after the repair finished.' });
  E('m_brkform', 'm_gapdown');
  E('m_repair', 'm_mach', loop('Machine back, queue resumes'));
  E('m_newmach', 'm_mm');

  /* ---- 6 Packing & dispatch ---- */
  M('m_ready2', 5, 0, 4, 'decision', 'Ready to dispatch? (check net stock)', { actor: 'Stores / sales', summary: 'Net stock is checked against the order line by eye.', reads: ['s_itemq', 's_orders'], pains: ['Q1', 'Q7'], automations: ['A3'] });
  M('m_pack', 5, 1, 4, 'action', 'Pack', { actor: 'Stores / packing', summary: 'Box no. and UPC columns exist in the product master but are mostly empty.', automations: ['C8'], evidence: 'product-master/image (2).png' });
  M('m_inv', 5, 2, 1, 'doc', 'Raise outward invoice', { actor: 'Invoice clerk', summary: 'Outward invoice (T/26-27/nn) is entered in INV/PUR. Its price lookup key has no PO, so the value shows PRICE NOT FOUND.', touch: { verb: 'add', doc: 's_invpur', fields: ['Invoice no., date', 'Item, qty, party', 'Weight', 'Customer order no.'] }, pains: ['Q2'], automations: ['A2', 'D2'], evidence: 'erp/image (1) (1).png' });
  M('m_exp2', 5, 3, 1, 'decision', 'Export shipment?', { actor: 'Sales', summary: 'Export consignments need additional paperwork.', automations: ['D4'] });
  M('m_expdocs', 5, 3, 7, 'action', 'Prepare export documents', { actor: 'Accounts', summary: 'Shipping and export paperwork is prepared outside the sheets.', assumed: true, automations: ['D4'] });
  M('m_upd2', 5, 4, 1, 'doc', 'Update ORDERS: dispatch refs + balance', { actor: 'Order desk', summary: 'Up to four dispatch invoice refs per line are typed, plus total dispatched and balance.', touch: { verb: 'update', doc: 's_orders', fields: ['Dispatch invoice refs (up to 4)', 'Total dispatch', 'Balance remaining'] }, pains: ['Q1'], automations: ['A2', 'A3'], evidence: 'erp/image (1).png' });
  M('m_cust', 5, 5, 0, 'external', 'Customer receives goods', { actor: 'Customer', summary: 'Delivery confirmation is not tracked in the shared files.', automations: ['A7'] });
  M('m_bal', 5, 5, 1, 'decision', 'Balance left on order?', { actor: 'Order desk', summary: 'Many lines are left with small balances (1 to 20 pcs) for months.', automations: ['A8'], evidence: 'erp/image (1).png' });
  M('m_end', 5, 6, 1, 'trigger', 'Order closed', { actor: 'Order desk', summary: 'The order line stops appearing as pending.' });
  M('m_short', 5, 6, 7, 'doc', 'Type "short close" remark', { actor: 'Management', summary: 'A stale balance is closed by typing "short close this order" in the remarks.', touch: { verb: 'edit', doc: 's_orders', fields: ['Remarks'] }, automations: ['A8'], evidence: 'erp/image (1).png' });

  E('m_ready2', 'm_pack', y({ condition: 'Enough finished stock' }));
  E('m_ready2', 'm_ready', loop('Not ready, back to planning', { condition: 'Stock figure says short' }));
  E('m_pack', 'm_inv');
  E('m_inv', 'm_exp2');
  E('m_exp2', 'm_expdocs', y());
  E('m_exp2', 'm_upd2', n());
  E('m_expdocs', 'm_upd2');
  E('m_upd2', 'm_cust', { handoff: 'Goods + invoice' });
  E('m_upd2', 'm_bal');
  E('m_bal', 'm_end', n({ condition: 'Fully dispatched' }));
  E('m_bal', 'm_ready', loop('Yes: balance still to make', { condition: 'Balance remains' }));
  E('m_bal', 'm_short', y({ label: 'Yes: stale', condition: 'Balance abandoned' }));
  E('m_short', 'm_end');

  /* ---- 7 Review ---- */
  M('m_vsr', 6, 0, 3, 'doc', 'Build vendor report by hand', { actor: 'Purchase', summary: 'One report per vendor. The header shows on-time 0.0% while the panel next to it shows 57.1%.', touch: { verb: 'update', doc: 's_vsr', fields: ['PO list per vendor', 'Fulfilment days', 'On-time %'] }, pains: ['Q12'], automations: ['B4'], evidence: 'erp/image (6).png' });
  M('m_costcopy', 6, 1, 2, 'doc', 'Copy costing sheet, update rates', { actor: 'Engineering', summary: 'Each item has its own copy. In the MV9650 sheet the total skips operation 4 (Rs 11.43/pc), so cost looks like Rs 54.37 instead of about Rs 65.80.', touch: { verb: 'update', doc: 's_cost', fields: ['RM weight and rate', 'Operation rows (machine, jig, gauge, pcs/hours)', 'Skill rate', 'Paint, overhead'] }, pains: ['Q3', 'Q4', 'Q5', 'Q6', 'Q17'], automations: ['F1', 'F2', 'I1'], evidence: 'product-master/Cost MV9650.xlsx, MV9650 Production Plan.xlsx' });
  M('m_pricerev', 6, 2, 2, 'doc', 'Price-revision calculation', { actor: 'Engineering / sales', summary: 'A side calculation on the product form compares old and new rate (e.g. 2.81% impact).', touch: { verb: 'update', doc: 's_cost', fields: ['Qty', 'Old rate / value', 'Price difference %'] }, automations: ['F4'], evidence: 'product-master/image (1).png' });
  M('m_mgmt', 6, 1, 7, 'action', 'Management asks for status', { actor: 'Management', summary: 'Status comes from phone calls and from reading sheets.', assumed: true, automations: ['J1'] });
  M('m_gapmargin', 6, 3, 7, 'gap', 'No per-order margin check', { actor: 'Nobody', summary: 'Selling price is never compared with a trusted cost per order line.', automations: ['F3'] });
  M('m_next', 6, 4, 7, 'trigger', 'Next order cycle', { actor: 'Customer', summary: 'The cycle restarts with the next PO (arrow not drawn: it would span the whole map).' });
  M('s_vsr', 6, 0, 8, 'store', 'Vendor report (VSR)', { actor: 'Google Sheet', summary: 'Per-vendor supply report with a performance panel.', pains: ['Q12'], evidence: 'erp/image (6).png' });
  M('s_cost', 6, 1, 8, 'store', 'Costing sheets (IMPORTRANGE)', { actor: 'Google Sheets', summary: 'One per item, linked to a central rate sheet through IMPORTRANGE. The Production Plan copy is all #REF!.', pains: ['Q3', 'Q4', 'Q17'], evidence: 'product-master/Cost MV9650.xlsx' });

  E('m_end', 'm_mgmt');
  E('m_end', 'm_vsr');
  E('m_end', 'm_costcopy');
  E('m_costcopy', 'm_pricerev');
  E('m_pricerev', 'm_gapmargin', { label: 'Price set without true cost' });
  E('m_mgmt', 'm_gapmargin');
  E('m_vsr', 'm_next');
  E('m_gapmargin', 'm_next');

  /* =====================================================================
   *  AUTOMATED (target state)
   * ===================================================================== */

  /* ---- 1 Order intake ---- */
  A('a_po', 0, 0, 0, 'external', 'Customer sends PO', { actor: 'Customer', summary: 'Same trigger as today. The difference starts at data entry.', replaces: ['m_po'] });
  A('a_intake', 0, 0, 1, 'auto', 'Capture PO from WhatsApp / email / portal', { actor: 'System', summary: 'The customer simply sends the PO the way they do today: a WhatsApp message (via WhatsApp Business API), an email with PDF or Excel attached, or a customer portal form. The system reads it, finds the customer from the sender, matches item codes and OE numbers to the product master, and pre-fills a draft order line.', automations: ['A9', 'A5'], replaces: ['m_typepo'] });
  A('a_pomatch', 0, 0, 2, 'decision', 'All fields matched with confidence?', { actor: 'System (rule)', summary: 'Customer, item, quantity, price and required date must all be found and consistent with the master. Anything uncertain is flagged instead of guessed.', automations: ['A9'], replaces: ['m_review'] });
  A('a_askback', 0, 1, 0, 'auto', 'Auto-reply asking customer for missing info', { actor: 'System', summary: 'For unknown items or missing quantity / date, an automatic reply goes back on the same channel listing exactly what is needed.', automations: ['A9', 'A7'], replaces: [] });
  A('a_entry', 0, 1, 1, 'approve', 'Sales confirms pre-filled PO draft', { actor: 'Sales', summary: 'Sales checks the draft next to the original message, corrects flagged fields and confirms. Nothing is re-typed from scratch.', touch: { verb: 'approve', doc: 't_order', fields: ['Confirm / correct draft order line', 'Fix flagged fields only'] }, automations: ['A9', 'A5'], replaces: ['m_review', 'm_typepo'] });
  A('a_valid', 0, 2, 1, 'auto', 'Validate HSN to GST, dates, duplicates', { actor: 'System', summary: 'HSN fills GST, required date must be on or after PO date, duplicate PO + item is blocked.', automations: ['A5', 'E3'], replaces: ['m_typepo'] });
  A('a_inmaster', 0, 3, 1, 'decision', 'Item in master?', { actor: 'System (rule)', summary: 'Picker search with duplicate / cross-reference matching on OE and original numbers.', automations: ['E2'], replaces: ['m_inmaster'] });
  A('a_wizard', 0, 3, 2, 'approve', 'New-product wizard', { actor: 'Engineering', summary: 'Code and MPN are generated and validated, HSN fills GST, dropdowns replace free text, BOM is built with pickers.', touch: { verb: 'add', doc: 't_item', fields: ['Type + dimensions', 'Material / finish (dropdown)', 'BOM children (picker)'] }, automations: ['E1', 'E2', 'E3', 'E4', 'E5'], replaces: ['m_prodform'] });
  A('a_draft', 0, 4, 2, 'auto', 'Draft costing + routing', { actor: 'System', summary: 'A costing draft and a routing draft are created from a template or a similar item.', automations: ['E6', 'F1', 'I1'], replaces: ['m_prodform'] });
  A('a_export', 0, 4, 1, 'decision', 'Export order?', { actor: 'System (rule)', summary: 'Decided from customer currency.', replaces: ['m_export'] });
  A('a_fx', 0, 4, 7, 'auto', 'Fetch + lock FX rate', { actor: 'System', summary: 'Daily reference rate fetched and locked per policy; booked vs realised FX is reported.', automations: ['A6'], replaces: ['m_fx'] });
  A('a_margin', 0, 5, 1, 'decision', 'Margin below threshold?', { actor: 'System (rule)', summary: 'Selling price against current routing-based cost.', automations: ['F3'], replaces: ['m_pricechk', 'm_cop'] });
  A('a_approve', 0, 5, 7, 'approve', 'Approve low-margin order', { actor: 'Management', summary: 'Only exceptions reach a person; one click approve or reject.', touch: { verb: 'approve', doc: 't_order', fields: ['Decision + reason'] }, replaces: ['m_pricechk'] });
  A('a_ctp', 0, 6, 1, 'auto', 'Promise date + acknowledgement', { actor: 'System', summary: 'Capable-to-promise inserts the order into the schedule and returns a promise date and its effect on other orders; the customer gets an acknowledgement.', automations: ['A4', 'A7'], replaces: ['m_stockdate'] });
  A('t_order', 0, 1, 8, 'store', 'Order book (DemandLine)', { actor: 'Ops Tracker', summary: 'One record per PO line with status computed from stock, schedule and dispatch.', replaces: ['s_orders'] });
  A('t_item', 0, 3, 8, 'store', 'Item + BOM + Routing', { actor: 'Ops Tracker', summary: 'Single master for product, BOM, routing and cost basis.', replaces: ['s_prodmaster'] });

  E('a_po', 'a_intake', { label: 'WhatsApp / email / portal', handoff: 'PO as PDF, Excel, photo or plain message', note: 'Customer behaviour does not change; the channel is read automatically.' });
  E('a_intake', 'a_pomatch', { handoff: 'Draft order line + confidence per field' });
  E('a_pomatch', 'a_entry', y({ condition: 'Everything matched', label: 'Yes: draft ready' }));
  E('a_pomatch', 'a_askback', n({ condition: 'Item unknown or field missing', label: 'No: missing info' }));
  E('a_pomatch', 'a_entry', n({ condition: 'Matched but uncertain', label: 'Unsure: flagged', handoff: 'Draft with flagged fields highlighted' }));
  E('a_askback', 'a_po', loop('Customer replies', { handoff: 'Missing details' }));
  E('a_entry', 'a_valid');
  E('a_valid', 'a_inmaster');
  E('a_inmaster', 'a_wizard', n({ condition: 'No match' }));
  E('a_wizard', 'a_draft', { handoff: 'New item' });
  E('a_draft', 'a_export');
  E('a_inmaster', 'a_export', y());
  E('a_export', 'a_fx', y());
  E('a_export', 'a_margin', n());
  E('a_fx', 'a_margin');
  E('a_margin', 'a_approve', y({ condition: 'Below threshold' }));
  E('a_margin', 'a_ctp', n());
  E('a_approve', 'a_ctp', { label: 'Approved' });
  E('a_ctp', 'a_free');

  /* ---- 2 Release & planning ---- */
  A('a_free', 1, 0, 4, 'decision', 'Free stock >= order qty?', { actor: 'System (rule)', summary: 'Free stock = ledger stock minus reservations. Reserves what it can.', automations: ['C1', 'A3'], replaces: ['m_ready'] });
  A('a_release', 1, 1, 5, 'auto', 'Release: Jobs + JobOps from routing', { actor: 'System', summary: 'Shortfall becomes jobs (lots) and one job-op per routing step. No checkbox.', automations: ['A1'], replaces: ['m_tick'] });
  A('a_gate', 1, 2, 4, 'decision', 'Casting available?', { actor: 'System (rule)', summary: 'Earliest start = casting receipt date, actual or promised.', automations: ['B8', 'C1'], replaces: ['m_castok'] });
  A('a_sched', 1, 3, 5, 'auto', 'Run scheduler (heuristics + CP-SAT)', { actor: 'System', summary: 'Deterministic heuristic portfolio, improved and checked by an exact solver when small enough. Same input gives the same plan.', automations: ['A1'], replaces: ['m_verbal', 'm_gap_sched'] });
  A('a_review', 1, 4, 5, 'approve', 'Planner reviews / overrides', { actor: 'Planner', summary: 'Plan, machine preference, late orders and utilisation are shown; the planner can pin or override.', touch: { verb: 'approve', doc: 't_sched', fields: ['Accept plan', 'Override machine / date (optional)'] }, replaces: ['m_verbal'] });
  A('a_eta', 1, 5, 1, 'auto', 'Write ETA back to order line', { actor: 'System', summary: 'Computed completion date and status replace the typed stock / projected date.', automations: ['A1', 'A3'], replaces: ['m_stockdate'] });
  A('t_ledger', 1, 0, 8, 'store', 'Stock ledger', { actor: 'Ops Tracker', summary: 'Append-only ledger: inward, outward, job, reject, scrap, adjustments. Stock is derived; negatives alert.', replaces: ['s_invpur', 's_itemq', 's_challan'] });
  A('t_sched', 1, 3, 8, 'store', 'Schedule (PlanRun)', { actor: 'Ops Tracker', summary: 'Immutable plan snapshots with input hash.', replaces: [] });

  E('a_free', 'a_list', y({ condition: 'Stock covers order', note: 'Goes to the dispatch-ready list; nothing is typed.' }));
  E('a_free', 'a_release', n({ condition: 'Short or partly short' }));
  E('a_release', 'a_gate');
  E('a_gate', 'a_sched', y());
  E('a_gate', 'a_mrp', n({ condition: 'Castings missing' }));
  E('a_sched', 'a_review', { handoff: 'Proposed plan' });
  E('a_sched', 'a_eta');
  E('a_review', 'a_card', { label: 'Plan approved', handoff: 'Job released at planned start' });

  /* ---- 3 Procurement ---- */
  A('a_mrp', 2, 0, 3, 'auto', 'MRP-lite: net need, draft POs', { actor: 'System', summary: 'Net requirement = open order balance - free stock - WIP - open POs, exploded through the BOM; draft POs grouped by vendor with need-by dates.', automations: ['B5'], replaces: ['m_buydec'] });
  A('a_poapp', 2, 1, 7, 'approve', 'Purchase approves PO', { actor: 'Purchase / EA', summary: 'One-click approval with value limits and an audit trail.', touch: { verb: 'approve', doc: 't_po', fields: ['Approve / reject'] }, automations: ['B7'], replaces: ['m_okapp'] });
  A('a_send', 2, 2, 3, 'auto', 'Send PO, capture promised date', { actor: 'System', summary: 'PO sent to the vendor; promised date captured so delay is measured against it.', automations: ['B3'], replaces: ['m_pologged'] });
  A('a_rate', 2, 2, 7, 'auto', 'Rate watch, re-run costing', { actor: 'System', summary: 'Alerts when per-kg rate moves more than x% and re-runs costing for affected items.', automations: ['B6', 'F1'], replaces: [] });
  A('a_overdue', 2, 3, 3, 'decision', 'Overdue vs promise?', { actor: 'System (rule)', summary: 'Checked daily; no one has to look at a red cell.', automations: ['B3'], replaces: ['m_wait', 'm_overdue'] });
  A('a_remind', 2, 4, 3, 'auto', 'Reminder ladder to vendor', { actor: 'System', summary: 'Reminders T-3 days, on the due date, then weekly; each lists only that vendor\'s lines.', automations: ['B1'], replaces: ['m_chase'] });
  A('a_esc', 2, 5, 3, 'approve', 'Purchase head steps in after n reminders', { actor: 'Purchase head', summary: 'Escalation lands in the head\'s inbox with the history attached.', touch: { verb: 'approve', doc: 't_po', fields: ['Chase, replace vendor or close line'] }, automations: ['B1'], replaces: ['m_chase'] });
  A('t_po', 2, 1, 8, 'store', 'PO + vendor', { actor: 'Ops Tracker', summary: 'PO lines with promised dates, received qty and vendor scorecard data.', replaces: ['s_po'] });

  E('a_mrp', 'a_poapp', { handoff: 'Draft POs' });
  E('a_poapp', 'a_send', { label: 'Approved' });
  E('a_send', 'a_rate');
  E('a_send', 'a_overdue');
  E('a_overdue', 'a_remind', y({ condition: 'Past promised date' }));
  E('a_overdue', 'a_ship', n({ condition: 'On time', note: 'Goods arrive; receipt is scanned.' }));
  E('a_remind', 'a_esc', { label: 'After n reminders' });
  E('a_remind', 'a_overdue', loop('Re-check'));

  /* ---- 4 Inward & QC ---- */
  A('a_ship', 3, 0, 0, 'external', 'Foundry ships castings', { actor: 'Foundry', summary: 'Challan carries a QR or PO reference; heat code is mandatory.', replaces: ['m_ship'] });
  A('a_scan', 3, 1, 4, 'approve', 'Stores scans / confirms receipt', { actor: 'Stores', summary: 'Scan the PO or challan QR, enter received qty and weight once. Nothing is re-typed elsewhere.', touch: { verb: 'scan', doc: 't_ledger', fields: ['PO / challan', 'Qty, weight', 'Heat code'] }, automations: ['C8', 'C1'], replaces: ['m_recv', 'm_inward'] });
  A('a_tol', 3, 2, 4, 'decision', 'Over tolerance?', { actor: 'System (rule)', summary: 'Received vs ordered against the vendor / material tolerance.', automations: ['B2'], replaces: ['m_qtychk'] });
  A('a_hold', 3, 2, 3, 'auto', 'Hold lot, email vendor', { actor: 'System', summary: 'Lot is held and the vendor is emailed automatically.', automations: ['B2'], replaces: ['m_overmail'] });
  A('a_exc', 3, 3, 3, 'approve', 'Approve exception', { actor: 'Purchase', summary: 'Accept the excess or return it.', touch: { verb: 'approve', doc: 't_po', fields: ['Accept / return'] }, replaces: ['m_overmail'] });
  A('a_wv', 3, 3, 4, 'decision', 'Weight within +/- x%?', { actor: 'System (rule)', summary: 'Recorded weight against standard weight; also supports foundry claims.', automations: ['C5'], replaces: ['m_qual'] });
  A('a_rej', 3, 4, 3, 'auto', 'Reject challan PDF + debit-note draft', { actor: 'System', summary: 'Challan is generated with party GSTIN and address from the master; a debit note draft is linked to the PO.', automations: ['D2', 'D3'], replaces: ['m_rej'] });
  A('a_post', 3, 4, 4, 'auto', 'Post inward, update PO, release job', { actor: 'System', summary: 'Ledger entry, PO received qty and status, and the job\'s earliest start are updated in one step.', automations: ['C1', 'B8'], replaces: ['m_upd', 'm_pofull'] });
  A('a_heat', 3, 5, 4, 'auto', 'Capture heat code, trace to lot', { actor: 'System', summary: 'Heat number follows the casting through the job and the finished lot.', automations: ['I3'], replaces: [] });
  A('a_foundry_rej', 3, 5, 0, 'external', 'Foundry receives rejects', { actor: 'Foundry', summary: 'Gets the challan and the debit note.', replaces: ['m_foundry_rej'] });

  E('a_ship', 'a_scan');
  E('a_scan', 'a_tol');
  E('a_tol', 'a_hold', y({ condition: 'Over tolerance' }));
  E('a_hold', 'a_exc');
  E('a_exc', 'a_wv');
  E('a_tol', 'a_wv', n());
  E('a_wv', 'a_rej', n({ condition: 'Out of range' }));
  E('a_wv', 'a_post', y({ condition: 'Within range' }));
  E('a_rej', 'a_foundry_rej', { handoff: 'Challan + debit note' });
  E('a_rej', 'a_overdue', loop('Replacement tracked', { note: 'Replacement gets a promised date like any PO line.' }));
  E('a_post', 'a_heat');
  E('a_post', 'a_card', { label: 'Casting available', handoff: 'Job can start' });

  /* ---- 5 Production + maintenance ---- */
  A('a_card', 4, 0, 5, 'auto', 'Print job card + QR', { actor: 'System', summary: 'Routing steps, fixture, gauge, control spec, qty and due date on one card.', automations: ['I2'], replaces: ['m_issue'] });
  A('a_ops', 4, 1, 5, 'approve', 'Operator scans start / stop, good / reject qty', { actor: 'Operator', summary: 'The one entry that books production: replaces the machine log, the stock figure and the schedule actual.', touch: { verb: 'scan', doc: 't_ledger', fields: ['Job-op start / stop', 'Good qty', 'Reject qty'] }, automations: ['C2'], replaces: ['m_mach', 'm_finish', 'm_gapfg'] });
  A('a_actual', 4, 2, 5, 'auto', 'Update schedule actuals', { actor: 'System', summary: 'Execution events replace estimates.', automations: ['C2'], replaces: ['m_gapfg'] });
  A('a_slip', 4, 3, 5, 'decision', 'Running late?', { actor: 'System (rule)', summary: 'Actual vs plan per job-op.', replaces: [] });
  A('a_replan', 4, 3, 7, 'auto', 'Re-plan affected jobs', { actor: 'System', summary: 'Triggered by slip, machine down or a new order; deterministic.', automations: ['A1'], replaces: ['m_gap_sched'] });
  A('a_jwq', 4, 4, 5, 'decision', 'Job-work step?', { actor: 'System (rule)', summary: 'Known from the routing.', replaces: ['m_jwq'] });
  A('a_jwchal', 4, 4, 4, 'auto', 'Job challan PDF + job-worker balance', { actor: 'System', summary: 'Challan is generated; pending-with-job-worker balance runs with ageing; ITC-04 data accumulates.', automations: ['D1', 'D2'], replaces: ['m_jwout'] });
  A('a_jw', 4, 5, 0, 'external', 'Job worker processes', { actor: 'Job worker', summary: 'Same external step.', replaces: ['m_jw'] });
  A('a_jwscan', 4, 5, 4, 'approve', 'Scan return', { actor: 'Stores', summary: 'Scan the returned lot against the open challan.', touch: { verb: 'scan', doc: 't_jw', fields: ['Challan', 'Returned qty / weight'] }, automations: ['D1'], replaces: ['m_jwin'] });
  A('a_jwvar', 4, 6, 4, 'decision', 'Variance vs sent?', { actor: 'System (rule)', summary: 'Compared automatically with the challan.', automations: ['D1'], replaces: ['m_tally'] });
  A('a_jwalert', 4, 6, 3, 'auto', 'Alert + hold lot', { actor: 'System', summary: 'Mismatch goes to stores and purchase with the numbers.', automations: ['D1'], replaces: ['m_rec'] });
  A('a_qc', 4, 6, 5, 'auto', 'In-process QC checklist', { actor: 'System', summary: 'Checklist per operation from gauge and spec; readings captured; heat code carried.', automations: ['I3'], replaces: ['m_insp'] });
  A('a_pass', 4, 7, 5, 'decision', 'QC pass?', { actor: 'System (rule)', summary: 'Rule on the recorded readings.', replaces: ['m_insp'] });
  A('a_rework', 4, 7, 4, 'auto', 'Rework / scrap booked', { actor: 'System', summary: 'Reject qty from the scan is posted to the ledger as rework or scrap.', automations: ['C2'], replaces: ['m_scrap'] });
  A('a_book', 4, 8, 5, 'auto', 'Book FG, consume casting + BOM children', { actor: 'System', summary: 'Final operation posts finished goods and consumes the casting and any child parts.', automations: ['C2', 'C4'], replaces: ['m_gapfg', 'm_scrap'] });

  A('a_brk', 4, 0, 6, 'trigger', 'Machine breaks down', { actor: 'Machine', summary: 'Same event, different response.', replaces: ['m_brk'] });
  A('a_scanm', 4, 1, 6, 'approve', 'Operator scans machine QR, raises ticket', { actor: 'Operator', summary: 'Machine is pre-filled; the ticket opens at breakdown time instead of days later.', touch: { verb: 'scan', doc: 't_brk', fields: ['Machine (QR)', 'Fault description'] }, automations: ['G1'], replaces: ['m_verbalbrk', 'm_brkform'] });
  A('a_down', 4, 2, 6, 'auto', 'Machine DOWN, re-plan', { actor: 'System', summary: 'Status flips to DOWN in the machine calendar; jobs move to other eligible machines.', automations: ['G1', 'H1'], replaces: ['m_gapdown'] });
  A('a_notify', 4, 3, 6, 'auto', 'Notify supervisor + maintenance', { actor: 'System', summary: 'Message with machine, fault and jobs affected.', automations: ['G1'], replaces: ['m_gapdown'] });
  A('a_close', 4, 4, 6, 'approve', 'Maintenance logs fix, closes ticket', { actor: 'Maintenance', summary: 'Action, parts and cost entered once; duration is computed from the timestamps.', touch: { verb: 'update', doc: 't_brk', fields: ['Action taken', 'Parts / cost', 'Close ticket'] }, automations: ['G1'], replaces: ['m_repair', 'm_brkform'] });
  A('a_mttr', 4, 5, 6, 'auto', 'MTTR / MTBF, repeat-failure flag', { actor: 'System', summary: 'Per machine and failure type; repeated failures such as the APC battery are flagged.', automations: ['G2'], replaces: [] });
  A('a_pm', 4, 6, 6, 'auto', 'PM calendar, spares, warranty alerts', { actor: 'System', summary: 'Preventive tasks and reminders from breakdown history; spares reorder; warranty expiry alerts. Planned windows go to the scheduler.', automations: ['G3', 'G4', 'G5'], replaces: [] });
  A('a_newm', 4, 7, 6, 'trigger', 'New machine installed', { actor: 'Maintenance', summary: 'Same event.', replaces: ['m_newmach'] });
  A('a_mmentry', 4, 8, 6, 'approve', 'Enter machine once (validated)', { actor: 'Maintenance / admin', summary: 'Operations come from a picklist; cost, dates and warranty are validated.', touch: { verb: 'add', doc: 't_mach', fields: ['Machine, make, dates', 'Cost', 'Operations (picklist)', 'Warranty, spares'] }, automations: ['H1', 'H2'], replaces: ['m_mm'] });
  A('t_brk', 4, 2, 8, 'store', 'Breakdown + PM', { actor: 'Ops Tracker', summary: 'Tickets, PM plan and spares.', replaces: ['s_brk'] });
  A('t_jw', 4, 5, 8, 'store', 'Job-work ledger', { actor: 'Ops Tracker', summary: 'Open challans with ageing and ITC-04 data.', replaces: [] });
  A('t_mach', 4, 8, 8, 'store', 'Machine master + calendar', { actor: 'Ops Tracker', summary: 'Capability, eligibility, status and shifts for the scheduler.', replaces: ['s_mm'] });

  E('a_card', 'a_ops');
  E('a_ops', 'a_actual', { handoff: 'Start / stop, good / reject qty' });
  E('a_actual', 'a_slip');
  E('a_slip', 'a_replan', y({ condition: 'Behind plan' }));
  E('a_replan', 'a_sched', loop('New plan'));
  E('a_slip', 'a_jwq', n());
  E('a_jwq', 'a_jwchal', y({ condition: 'Step is external' }));
  E('a_jwq', 'a_qc', n({ condition: 'In-house' }));
  E('a_jwchal', 'a_jw', { handoff: 'Challan + parts' });
  E('a_jw', 'a_jwscan', { handoff: 'Processed parts' });
  E('a_jwscan', 'a_jwvar');
  E('a_jwvar', 'a_jwalert', y({ condition: 'Mismatch' }));
  E('a_jwvar', 'a_qc', n());
  E('a_jwalert', 'a_qc', { label: 'Resolved' });
  E('a_qc', 'a_pass');
  E('a_pass', 'a_rework', n({ condition: 'Out of spec' }));
  E('a_pass', 'a_book', y());
  E('a_rework', 'a_ops', loop('Rework'));
  E('a_book', 'a_list', { label: 'FG in stock', handoff: 'Stock updated, nothing typed' });

  E('a_brk', 'a_scanm');
  E('a_scanm', 'a_down');
  E('a_down', 'a_notify');
  E('a_down', 'a_replan', { label: 'Jobs moved' });
  E('a_notify', 'a_close');
  E('a_close', 'a_mttr');
  E('a_mttr', 'a_pm');
  E('a_pm', 'a_sched', { label: 'Planned windows', kind: 'loop', note: 'PM windows are injected into the schedule so they never collide with committed jobs.' });
  E('a_newm', 'a_mmentry');
  E('a_mmentry', 'a_sched', { label: 'Machine available', kind: 'loop' });

  /* ---- 6 Packing & dispatch ---- */
  A('a_list', 5, 0, 1, 'auto', 'Daily dispatch-ready list', { actor: 'System', summary: 'Order status is derived from stock, schedule and PO data, grouped by customer.', automations: ['A3'], replaces: ['m_ready2'] });
  A('a_conf', 5, 1, 4, 'approve', 'Dispatch confirms packing', { actor: 'Stores / dispatch', summary: 'Confirm quantities and box labels; scan.', touch: { verb: 'scan', doc: 't_ledger', fields: ['Packed qty', 'Box / label'] }, automations: ['C8'], replaces: ['m_pack'] });
  A('a_alloc', 5, 2, 1, 'auto', 'Allocate to PO line (FIFO)', { actor: 'System', summary: 'Quantity goes to the oldest open line for the same mark + item; price comes from that line.', automations: ['A2'], replaces: ['m_upd2', 'm_inv'] });
  A('a_docs', 5, 3, 1, 'auto', 'Invoice / challan PDF + e-way JSON', { actor: 'System', summary: 'Invoice numbering, party details, valuation and e-way / e-invoice JSON generated from the dispatch.', automations: ['D2', 'D4'], replaces: ['m_inv', 'm_exp2', 'm_expdocs'] });
  A('a_bal', 5, 4, 1, 'decision', 'Balance left?', { actor: 'System (rule)', summary: 'Balance and status update from the allocation.', automations: ['A3'], replaces: ['m_bal'] });
  A('a_notice', 5, 4, 0, 'auto', 'Dispatch notice to customer', { actor: 'System', summary: 'Invoice no., qty and vehicle sent to the customer.', automations: ['A7'], replaces: [] });
  A('a_cust', 5, 5, 0, 'external', 'Customer receives goods', { actor: 'Customer', summary: 'Same as today.', replaces: ['m_cust'] });
  A('a_short', 5, 5, 1, 'auto', 'Short-close suggestion', { actor: 'System', summary: 'Suggested when balance is small or old.', automations: ['A8'], replaces: ['m_short'] });
  A('a_end', 5, 6, 1, 'trigger', 'Order closed', { actor: 'System', summary: 'Closed with reason and timestamp.', replaces: ['m_end'] });
  A('a_shortok', 5, 6, 7, 'approve', 'Approve short-close', { actor: 'Management', summary: 'One click, reason kept.', touch: { verb: 'approve', doc: 't_order', fields: ['Short-close + reason'] }, automations: ['A8'], replaces: ['m_short'] });

  E('a_list', 'a_conf');
  E('a_conf', 'a_alloc');
  E('a_alloc', 'a_docs');
  E('a_docs', 'a_notice');
  E('a_notice', 'a_cust');
  E('a_docs', 'a_bal');
  E('a_bal', 'a_end', n({ condition: 'Fully dispatched' }));
  E('a_bal', 'a_release', loop('Yes: still to make', { note: 'The balance is re-planned automatically; nothing is re-released by hand.' }));
  E('a_bal', 'a_short', y({ label: 'Yes: stale' }));
  E('a_short', 'a_shortok');
  E('a_shortok', 'a_end');

  /* ---- 7 Review ---- */
  A('a_vs', 6, 0, 3, 'auto', 'Vendor scorecards, monthly', { actor: 'System', summary: 'OTIF, fulfilment days, over/under-receipt, incoming rejection %, rate trend; emailed monthly.', automations: ['B4'], replaces: ['m_vsr'] });
  A('a_cost', 6, 1, 2, 'auto', 'Costing recalculates on rate change', { actor: 'System', summary: 'One routing and one rate table; every item recalculates when a rate changes; machine-hour rate includes depreciation and maintenance.', automations: ['F1', 'F2'], replaces: ['m_costcopy'] });
  A('a_marg', 6, 2, 2, 'auto', 'Margin monitor, loss-makers list', { actor: 'System', summary: 'Selling price vs current cost on every order line.', automations: ['F3'], replaces: ['m_gapmargin'] });
  A('a_pr', 6, 3, 2, 'auto', 'Price-revision proposal', { actor: 'System', summary: 'Proposed new price per customer and item with the impact on open orders.', automations: ['F4'], replaces: ['m_pricerev'] });
  A('a_pra', 6, 4, 7, 'approve', 'Approve revision', { actor: 'Management', summary: 'Approve or adjust; letter is generated.', touch: { verb: 'approve', doc: 't_cost', fields: ['New price + effective date'] }, automations: ['F4'], replaces: ['m_pricerev'] });
  A('a_mis', 6, 1, 7, 'auto', 'Daily MIS digest', { actor: 'System', summary: 'Overdue lines, dispatch-ready value, late POs, machines down, rejects, negative stock, low-margin orders.', automations: ['J1'], replaces: ['m_mgmt'] });
  A('a_dh', 6, 2, 7, 'auto', 'Data-health watchdog', { actor: 'System', summary: 'Nightly scan for impossible dates, blanks and HSN/GST mismatches.', automations: ['J2'], replaces: [] });
  A('a_audit', 6, 3, 7, 'auto', 'Audit trail on every change', { actor: 'System', summary: 'Who changed what, with role-based access.', automations: ['J3'], replaces: [] });
  A('a_next', 6, 5, 7, 'trigger', 'Next order cycle', { actor: 'Customer', summary: 'The cycle restarts with the next PO (arrow not drawn: it would span the whole map).', replaces: ['m_next'] });
  A('t_cost', 6, 1, 8, 'store', 'Costing + rate master', { actor: 'Ops Tracker', summary: 'Rates, routings, versioned costing.', replaces: ['s_cost', 's_vsr'] });

  E('a_end', 'a_mis');
  E('a_end', 'a_vs');
  E('a_end', 'a_cost');
  E('a_end', 'a_dh');
  E('a_cost', 'a_marg');
  E('a_marg', 'a_pr');
  E('a_pr', 'a_pra');
  E('a_pra', 'a_next');
  E('a_vs', 'a_next');
  E('a_dh', 'a_audit');


  /* [term, full form / meaning, optional note, caseInsensitive] */
  var glossary = [
    ['PO', 'Purchase Order', 'A buyer\'s order to a seller. Customer POs come in; our POs go out to foundries.'],
    ['FX', 'Foreign Exchange (rate)', 'Rupee value of a US / Canadian dollar order, fixed ("locked") on a chosen date.'],
    ['COP', 'Term used in the client\'s sheets', 'Appears as "COP price key" and "COP HISTORY". Exact meaning not yet confirmed with the client (maybe customer order price).'],
    ['HSN', 'Harmonized System of Nomenclature', 'Tax code that classifies the goods; it decides the GST rate.'],
    ['GST', 'Goods and Services Tax', 'Indian indirect tax; 18% on most parts here.'],
    ['GSTIN', 'GST Identification Number', 'A party\'s 15-character GST registration number.'],
    ['ITC-04', 'GST return form for job work', 'Reports goods sent to and received back from job workers.'],
    ['e-way', 'Electronic way bill', 'GST transport document required for moving goods above a value limit.', true],
    ['e-invoice', 'Electronic invoice', 'Invoice registered on the GST portal.', true],
    ['MPN', 'Manufacturer Part Number', 'Our own internal part number series for a customer part (e.g. BFA... for AM, BFM... for MNS).'],
    ['OE', 'Original Equipment', '"OE no." is the vehicle maker\'s own part number.'],
    ['SP', 'Selling Price', ''],
    ['RM', 'Raw Material', 'Here mostly rough castings (SG iron, cast iron, mild steel).'],
    ['BOM', 'Bill Of Materials', 'The child parts (bolt, nut, bush...) that make up an assembly.'],
    ['FG', 'Finished Goods', 'Parts that are fully machined, painted and ready to ship.'],
    ['WIP', 'Work In Progress', 'Parts currently somewhere between casting and finished.'],
    ['MRP', 'Material Requirements Planning', 'Works out what to buy, and when, from orders, stock and BOM. "MRP-lite" is a simple version.'],
    ['CTP', 'Capable To Promise', 'Quoting a delivery date by testing the order against the live schedule.'],
    ['capable-to-promise', 'Capable To Promise', 'Quoting a delivery date by testing the order against the live schedule.', true],
    ['ETA', 'Estimated Time of Arrival / completion', 'The date the system expects an order to finish.'],
    ['CP-SAT', 'Constraint Programming - SATisfiability solver', 'Google OR-Tools exact solver, used to check or improve the schedule.'],
    ['FIFO', 'First In, First Out', 'Oldest open order line is served first.'],
    ['QC', 'Quality Control', ''],
    ['QR', 'Quick Response (code)', 'Scannable square barcode on a machine, job card or challan.'],
    ['PM', 'Preventive Maintenance', 'Planned servicing done before a breakdown (not "project manager").'],
    ['MTTR', 'Mean Time To Repair', 'Average hours a machine is down per breakdown.'],
    ['MTBF', 'Mean Time Between Failures', 'Average run time between breakdowns.'],
    ['OTIF', 'On Time, In Full', 'Share of orders delivered by the date and in the right quantity.'],
    ['VSR', 'Vendor Supply Report', 'The client\'s per-vendor delivery performance sheet.'],
    ['MIS', 'Management Information System (report)', 'A regular summary for management.'],
    ['KPI', 'Key Performance Indicator', ''],
    ['UPC', 'Universal Product Code', 'Barcode number printed on a product box.'],
    ['EA', 'Read as "Executive Assistant"', 'From the sheet text "approved by Purchase/EA". To be confirmed.'],
    ['INV/PUR', 'Inventory / Purchase (sheet tab)', 'The ledger tab that holds all inward, outward, job-work and reject entries.'],
    ['IMPORTRANGE', 'Google Sheets function', 'Pulls values from another spreadsheet; used to read the central rate sheet.'],
    ['CNC', 'Computer Numerical Control', 'Machine tool run by a stored program.'],
    ['VMC', 'Vertical Machining Centre', 'CNC mill with a vertical spindle.'],
    ['HMC', 'Horizontal Machining Centre', 'CNC mill with a horizontal spindle.'],
    ['VMM', 'Vertical Milling Machine', 'Manual milling machine.'],
    ['VTL', 'Vertical Turning Lathe', 'Lathe for large, heavy round parts.'],
    ['APC', 'Automatic Pallet Changer (likely)', 'Part of a CNC machine; its battery failed four times in the breakdown log.'],
    ['AM', 'Customer mark: Automann', 'Short code that tags which customer a part belongs to.'],
    ['MNS', 'Customer mark (Mumbai buyer group)', 'MNS-1 to MNS-7 are separate Mumbai buyer accounts.'],
    ['AMNJ', 'Customer mark (US export buyer)', ''],
    ['challan', 'Delivery note', 'Document that travels with goods; used here for rejects going back to a foundry and for job work out and in.', true],
    ['casting', 'Rough metal part poured in a mould', 'The raw material that gets machined.', true],
    ['heat code', 'Melt batch number of the metal', 'Lets a finished part be traced back to the foundry batch.', true],
    ['job work', 'Work done by an outside vendor on our parts', 'For example shot blasting.', true],
    ['job-work', 'Work done by an outside vendor on our parts', 'For example shot blasting.', true],
    ['routing', 'Ordered list of machining steps for a part', 'Which machine type, in what sequence, with what time per piece.', true],
    ['DemandLine', 'One customer order line', 'Item + quantity + due date on a PO.'],
    ['JobOps', 'Operations of a job', 'One job-op = one routing step of a lot.'],
    ['Jobs', 'Production lots', 'A job is a lot made from an order line.'],
    ['PlanRun', 'One saved scheduling run', 'Immutable snapshot, so the same inputs always give the same plan.'],
    ['DOWN', 'Machine status: unavailable', 'The scheduler will not plan work on it.'],
    ['PRICE NOT FOUND', 'Error text in the client\'s ledger', 'The price lookup key was built with a blank PO number.'],
    ['Regmark', 'Registration mark', 'Marking step in the paint section.', true],
    ['M-seal', 'A sealant putty', 'First step in the paint section.', true],
    ['Pareto', 'Pareto chart', 'Bars sorted from biggest cause to smallest, to show where most of a problem comes from.', true],
    ['NCR', 'Non-Conformance Report', 'A record of a part or lot that failed spec, and what was done about it.'],
    ['Pareto', 'Pareto chart', 'Bars sorted from biggest cause to smallest, to show where most of a problem comes from.', true],
    ['NCR', 'Non-Conformance Report', 'A record of a part or lot that failed spec, and what was done about it.'],
    ['SG', 'Spheroidal Graphite (ductile) iron', 'e.g. SG 500/7 casting grade.'],
    ['WhatsApp Business API', 'Official way for a business system to send and receive WhatsApp messages', 'Needs a registered business number; lets the system read incoming orders and reply.', true],
    ['portal', 'Customer web page', 'A simple order form or login page where customers submit POs themselves.', true]
  ];


  /* ---- Product features (screens people use). Sit in the last lane of the automated map; users = automated nodes that show up in them. ---- */
  var FEATURES = [
    ['f_portal', 0, 0, 'Customer portal', 'Customers see order status, dispatch notices and invoices, and can upload a PO. The front end for A9.', 'Today customers phone or message to ask where an order is.', ['a_intake', 'a_notice', 'a_ctp']],
    ['f_item360', 0, 3, 'Item 360 + catalogue search', 'One page per item: stock by state, open orders and POs, WIP, price history, BOM tree. Search by OE no., MPN, original no. or customer mark.', 'Replaces the Item query sheet, which is full of #DIV/0! and #VALUE! errors.', ['a_inmaster', 'a_wizard', 'a_post']],
    ['f_whatif', 1, 3, 'What-if simulator', 'Add a rush order, drop a machine or move a casting date, and compare the new plan with the current one.', 'Today there is no plan to compare against.', ['a_sched', 'a_ctp', 'a_replan']],
    ['f_timeline', 1, 4, 'Machine timeline + load heatmap', 'What runs on which machine and when, with utilisation per machine and the bottleneck highlighted. Also a machine preference table: one item on different machines, with time, cost and margin side by side.', 'This is the client\'s own question: which machine is producing what and when.', ['a_review', 'a_sched', 'a_slip']],
    ['f_orderbook', 1, 5, 'Order book with ageing', 'Open order value by customer, due week and balance, with a promise-date calendar.', 'Small balances stay open for months and status is typed text.', ['a_eta', 'a_list', 'a_bal']],
    ['f_vendor', 2, 2, 'Vendor portal + scorecard', 'Vendors see open POs, set promised dates, upload challans and heat certificates, and see their own scorecard.', 'Today delay is measured from the PO date and chasing is manual.', ['a_send', 'a_remind', 'a_vs']],
    ['f_quality', 3, 3, 'Quality register + rejection Pareto', 'Non-conformance and corrective-action tracking, rejection charts by foundry, defect and item, and inspection records against each operation\'s spec.', 'No quality register exists; incoming rejection is about 1%.', ['a_wv', 'a_rej', 'a_qc', 'a_rework']],
    ['f_tablet', 4, 1, 'Shop-floor tablet mode', 'Large-button screen per machine: scan the job card, start, stop, good and reject quantity.', 'Production completion is not booked anywhere today.', ['a_ops', 'a_card', 'a_scanm']],
    ['f_jwreg', 4, 4, 'Job-work register', 'Pending with each job worker, by challan, with ageing and a one-year return tracker.', '"Net pending with JW" is worked out by hand.', ['a_jwchal', 'a_jwscan', 'a_jwvar']],
    ['f_machpage', 4, 5, 'Machine page + downtime Pareto', 'Specs, warranty, spares, full breakdown history and cost; repeat-failure view.', 'HMC001 lost 98 h; the APC battery failed 4 times.', ['a_mttr', 'a_pm', 'a_close']],
    ['f_costwb', 6, 1, 'Costing workbench + margin explorer', 'Cost builder per item with a breakdown chart, rate master with history, margin by customer, item or order, and a quote builder.', 'Costing lives in copied sheets and one has a live formula bug.', ['a_cost', 'a_marg', 'a_pr', 'a_margin']],
    ['f_dash', 6, 3, 'Owner dashboard', 'Open order value, overdue lines, dispatch-ready value, machines down and low-margin orders on one screen, plus an approvals inbox.', 'Management asks by phone and reads sheets.', ['a_mis', 'a_approve', 'a_shortok']]
  ];
  FEATURES.forEach(function (f) {
    A(f[0], f[1], f[2], 9, 'feature', f[3], { actor: 'Ops Tracker screen', summary: f[4], why: f[5], users: f[6] });
    f[6].forEach(function (u) { var n = nodes.filter(function (x) { return x.id === u; })[0]; (n.features = n.features || []).push(f[0]); });
  });

  window.PROCESS = { glossary: glossary, stages: stages, lanes: lanes, pains: pains, automations: automations, nodes: nodes, edges: edges };
})();
