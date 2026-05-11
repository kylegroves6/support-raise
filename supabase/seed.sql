-- Deterministic seed for E2E tests and local development.
-- Applied automatically by `supabase db reset`.
-- All IDs are fixed UUIDs so foreign-key joins are predictable across resets.
--
-- Test user: playwright@example.com / playwright-test-pw!
-- Contacts represent a realistic spread: financial partners, pledged, pending, and cold.

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_trip_id uuid := '00000000-0000-0000-0000-000000000010';
  v_c1      uuid := '00000000-0000-0000-0000-000000000021';
  v_c2      uuid := '00000000-0000-0000-0000-000000000022';
  v_c3      uuid := '00000000-0000-0000-0000-000000000023';
  v_c4      uuid := '00000000-0000-0000-0000-000000000024';
  v_c5      uuid := '00000000-0000-0000-0000-000000000025';
  v_c6      uuid := '00000000-0000-0000-0000-000000000026';
  v_c7      uuid := '00000000-0000-0000-0000-000000000027';
  v_c8      uuid := '00000000-0000-0000-0000-000000000028';
BEGIN

  -- ── Auth user ─────────────────────────────────────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'playwright@example.com',
    -- bcrypt hash of 'playwright-test-pw!'  (cost 10)
    '$2a$10$t.Cz8bvvEUKdUshKvYxsPOHq1byyt/7gdnLtar1hpqeYXjtM6b1ni',
    now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    'playwright@example.com',
    jsonb_build_object('sub', v_user_id::text, 'email', 'playwright@example.com'),
    'email', now(), now(), now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;

  -- ── Active trip ───────────────────────────────────────────────────────────
  INSERT INTO public.trips (id, user_id, mission_name, mission_start, mission_end, trip_cost, is_active)
  VALUES (
    v_trip_id, v_user_id,
    'Tokyo Mission 2026',
    '2026-08-01', '2026-08-15',
    5500,
    true
  ) ON CONFLICT (id) DO UPDATE SET
    mission_name  = EXCLUDED.mission_name,
    mission_start = EXCLUDED.mission_start,
    mission_end   = EXCLUDED.mission_end,
    trip_cost     = EXCLUDED.trip_cost,
    is_active     = EXCLUDED.is_active;

  -- ── Contacts ──────────────────────────────────────────────────────────────
  -- Varied relationships, addresses, phones, emails, and notes so the table
  -- looks like real data when browsing locally.
  INSERT INTO public.contacts (
    id, user_id,
    first_name, last_name, salutation, relationship,
    street_address, city, state, zip, country,
    phone, email, notes,
    "returning", top_priority
  ) VALUES
    -- Financial partner with full address and gift on record
    (v_c1, v_user_id,
     'James', 'Holloway', 'James', 'Friend',
     '142 Birchwood Lane', 'Nashville', 'TN', '37201', 'US',
     '615-204-8831', 'james.holloway@email.com',
     'Met at church retreat 2024. Very supportive of missions work.',
     true, 1),

    -- Financial partner — family member
    (v_c2, v_user_id,
     'Rachel', 'Monroe', 'Rachel', 'Family',
     '88 Oakdale Drive', 'Franklin', 'TN', '37064', 'US',
     '615-559-0274', 'rmonroe@gmail.com',
     'Sister-in-law. Gave last trip too.',
     true, 2),

    -- Pledged to give — waiting on check
    (v_c3, v_user_id,
     'Thomas', 'Berkshire', 'Tom', 'Church',
     '310 Maple Court', 'Brentwood', 'TN', '37027', 'US',
     '629-444-1762', 'tberkshire@churchmail.org',
     'Elder at Grace Chapel. Said he would give once he gets back from vacation.',
     false, 3),

    -- Contacted, no response yet
    (v_c4, v_user_id,
     'Claire', 'Ashford', 'Claire', 'Friend',
     '27 Sunset Blvd', 'Murfreesboro', 'TN', '37130', 'US',
     '615-788-3345', 'cashford@outlook.com',
     'Sent letter 6/10. Left voicemail 6/15.',
     false, null),

    -- Prayer partner only
    (v_c5, v_user_id,
     'David', 'Nguyen', 'David', 'Church',
     '504 River Bend Rd', 'Hendersonville', 'TN', '37075', 'US',
     '615-302-9910', 'david.nguyen@email.com',
     'Committed to praying monthly. Not in a position to give financially.',
     false, null),

    -- Not yet contacted — cold
    (v_c6, v_user_id,
     'Susan', 'Park', 'Susan', 'Friend',
     '19 Elm Street', 'Smyrna', 'TN', '37167', 'US',
     '615-841-0023', 'susan.park@gmail.com',
     'Friend from college. Havent reached out yet.',
     false, null),

    -- Not yet contacted — family
    (v_c7, v_user_id,
     'Mark', 'Holloway', 'Mark', 'Family',
     '142 Birchwood Lane', 'Nashville', 'TN', '37201', 'US',
     '615-204-9002', 'mark.holloway@email.com',
     'James''s brother. Suggested by James.',
     false, null),

    -- Returning partner, no address on file
    (v_c8, v_user_id,
     'Linda', 'Castillo', 'Linda', 'Church',
     '', '', '', '', 'US',
     '901-557-4418', 'lcastillo@churchmail.org',
     'Gave $100/month last trip. Moving — address TBD.',
     true, 4)
  ON CONFLICT (id) DO NOTHING;

  -- ── contact_trips — per-trip status ───────────────────────────────────────
  INSERT INTO public.contact_trips (
    trip_id, contact_id, user_id,
    sent, call_made, responded,
    financial_partner, prayer_partner, pledged_to_give,
    form_of_gift, gift_amount, date_received,
    thank_you_sent
  ) VALUES
    -- James: financial partner, check received
    (v_trip_id, v_c1, v_user_id,
     true, true, true,
     true, false, false,
     'Check', 300.00, '2026-06-01',
     true),

    -- Rachel: financial partner, online gift
    (v_trip_id, v_c2, v_user_id,
     true, true, true,
     true, false, false,
     'Online', 150.00, '2026-06-08',
     false),

    -- Thomas: pledged, letter sent, waiting
    (v_trip_id, v_c3, v_user_id,
     true, true, true,
     false, false, true,
     null, null, null,
     false),

    -- Claire: letter sent, call made, no response yet
    (v_trip_id, v_c4, v_user_id,
     true, true, false,
     false, false, false,
     null, null, null,
     false),

    -- David: prayer partner, letter sent
    (v_trip_id, v_c5, v_user_id,
     true, false, true,
     false, true, false,
     null, null, null,
     false),

    -- Susan: nothing done yet
    (v_trip_id, v_c6, v_user_id,
     false, false, false,
     false, false, false,
     null, null, null,
     false),

    -- Mark: nothing done yet
    (v_trip_id, v_c7, v_user_id,
     false, false, false,
     false, false, false,
     null, null, null,
     false),

    -- Linda: returning partner, letter sent
    (v_trip_id, v_c8, v_user_id,
     true, true, true,
     false, false, true,
     null, null, null,
     false)
  ON CONFLICT (trip_id, contact_id) DO NOTHING;

END $$;
