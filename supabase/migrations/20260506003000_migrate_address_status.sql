UPDATE contacts
SET address_status = CASE address_status
  WHEN 'Documented'    THEN 'Send by Mail'
  WHEN 'Hand Delivery' THEN 'Hand Delivery'
  WHEN 'Email'         THEN 'Digital Contact'
  WHEN 'Text'          THEN 'Digital Contact'
  WHEN 'Need to Look'  THEN ''
  WHEN 'Unavailable'   THEN ''
  WHEN 'Contacted'     THEN ''
  ELSE address_status
END
WHERE address_status IN ('Documented', 'Hand Delivery', 'Email', 'Text', 'Need to Look', 'Unavailable', 'Contacted');
