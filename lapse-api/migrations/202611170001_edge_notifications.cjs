// Add RPC operations over existing notification tables, never expiry mutations.
exports.up = async (db) => {
  await db.raw(`CREATE OR REPLACE FUNCTION public.lapse_push_register(p_user uuid,p_device uuid,p_token text,p_enabled boolean,p_preferences jsonb,p_version integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE account public.master_users; existing public.notification_devices;
 BEGIN
 SELECT * INTO account FROM public.master_users WHERE id=p_user AND is_active=true AND token_version=p_version FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive account'; END IF;
 SELECT * INTO existing FROM public.notification_devices WHERE id=p_device FOR UPDATE;
 IF FOUND AND existing.user_id<>p_user AND existing.token<>p_token THEN RAISE EXCEPTION 'installation conflict'; END IF;
 DELETE FROM public.notification_devices WHERE token=p_token AND id<>p_device;
 INSERT INTO public.notification_devices(id,user_id,token,enabled,token_version,updated_at) VALUES(p_device,p_user,p_token,p_enabled,account.token_version,clock_timestamp()) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,token=excluded.token,enabled=excluded.enabled,token_version=excluded.token_version,updated_at=excluded.updated_at;
 INSERT INTO public.notification_preferences(user_id,enabled,offsets,hour,timezone) VALUES(p_user,COALESCE((p_preferences->>'enabled')::boolean,true),COALESCE(p_preferences->'offsets','[7,1,0]'::jsonb),COALESCE((p_preferences->>'hour')::integer,9),COALESCE(p_preferences->>'timezone','UTC')) ON CONFLICT(user_id) DO NOTHING;
 RETURN true;
 END;$$`);
  await db.raw(`CREATE OR REPLACE FUNCTION public.lapse_push_claim(p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE row jsonb; account public.master_users; device public.notification_devices; item public.user_items; pref public.notification_preferences; previous public.notification_attempts; override_row jsonb; claimed integer; result jsonb='[]'::jsonb; logical text;
 BEGIN
 IF jsonb_array_length(p_rows)>100 THEN RAISE EXCEPTION 'batch too large'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 SELECT * INTO account FROM public.master_users WHERE id=(row->>'userId')::uuid AND is_active=true FOR UPDATE;
 IF NOT FOUND THEN CONTINUE; END IF;
 SELECT * INTO pref FROM public.notification_preferences WHERE user_id=account.id FOR UPDATE;
 SELECT * INTO device FROM public.notification_devices WHERE id=(row->>'deviceId')::uuid AND user_id=account.id AND enabled=true AND token_version=account.token_version FOR UPDATE;
 IF NOT FOUND THEN CONTINUE; END IF;
 IF row->>'kind'='test' THEN
 IF account.token_version IS DISTINCT FROM COALESCE((row->>'userVersion')::integer,-1) THEN CONTINUE; END IF;
 logical=account.id::text||':test:'||(row->>'requestId');
 SELECT * INTO previous FROM public.notification_attempts WHERE reminder_id=logical AND device_id=device.id;
 IF FOUND THEN result=result||jsonb_build_array(jsonb_build_object('id',logical,'deviceId',device.id,'state',previous.state,'replayed',true)); CONTINUE; END IF;
 IF EXISTS(SELECT 1 FROM public.notification_inbox WHERE user_id=account.id AND id LIKE account.id::text||':test:%' AND created_at>clock_timestamp()-interval '60 seconds') THEN RAISE EXCEPTION 'test cooldown' USING ERRCODE='P0002'; END IF;
 ELSE
 IF pref.enabled IS DISTINCT FROM true THEN CONTINUE; END IF;
 SELECT * INTO item FROM public.user_items WHERE id=(row->>'itemId')::uuid AND user_id=account.id FOR UPDATE;
 IF NOT FOUND OR item.expiry_type='NEVER' THEN CONTINUE; END IF;
 SELECT jsonb_build_object('mode',mode,'offsets',offsets) INTO override_row FROM public.notification_item_preferences WHERE item_id=item.id;
 override_row=COALESCE(override_row,'{"mode":"INHERIT","offsets":[]}'::jsonb);
 IF to_jsonb(item) IS DISTINCT FROM row->'itemSnapshot' OR jsonb_build_object('enabled',pref.enabled,'offsets',pref.offsets,'hour',pref.hour,'timezone',pref.timezone) IS DISTINCT FROM row->'preferenceSnapshot' OR override_row IS DISTINCT FROM row->'overrideSnapshot' THEN CONTINUE; END IF;
 logical=account.id::text||':'||item.id::text||':'||(row->>'occurrence')||':'||(row->>'offset');
 END IF;
 INSERT INTO public.notification_inbox(id,user_id,item_id,title,body,created_at) VALUES(logical,account.id,CASE WHEN row->>'kind'='test' THEN NULL ELSE item.id END,row->>'title',row->>'body',clock_timestamp()) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.notification_attempts(reminder_id,device_id,state,attempt_count,updated_at) VALUES(logical,device.id,'claimed',1,clock_timestamp()) ON CONFLICT(reminder_id,device_id) DO UPDATE SET state='claimed',attempt_count=notification_attempts.attempt_count+1,updated_at=clock_timestamp() WHERE notification_attempts.state='retry' AND notification_attempts.attempt_count<3;
 GET DIAGNOSTICS claimed=ROW_COUNT;
 IF claimed=1 THEN result=result||jsonb_build_array(jsonb_build_object('id',logical,'deviceId',device.id,'token',device.token,'title',row->>'title','body',row->>'body','test',row->>'kind'='test','itemId',CASE WHEN row->>'kind'='test' THEN '' ELSE item.id::text END)); END IF;
 END LOOP;
 RETURN result;
 END;$$`);
  await db.raw(`CREATE OR REPLACE FUNCTION public.lapse_push_results(p_rows jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE row jsonb; attempt public.notification_attempts;
 BEGIN
 IF jsonb_array_length(p_rows)>100 THEN RAISE EXCEPTION 'batch too large'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 SELECT * INTO attempt FROM public.notification_attempts WHERE reminder_id=row->>'id' AND device_id=(row->>'deviceId')::uuid AND state IN ('claimed','accepted') FOR UPDATE;
 IF NOT FOUND OR row->>'state' NOT IN ('accepted','failed','unknown','retry','receipt_ok','receipt_unknown') THEN CONTINUE; END IF;
 IF attempt.state='accepted' AND row->>'state' NOT IN ('failed','receipt_ok','receipt_unknown') THEN CONTINUE; END IF;
 UPDATE public.notification_attempts SET state=row->>'state',ticket=COALESCE(row->>'ticket',ticket),updated_at=clock_timestamp() WHERE reminder_id=attempt.reminder_id AND device_id=attempt.device_id;
 IF (row->>'invalidToken')::boolean IS TRUE THEN UPDATE public.notification_devices SET enabled=false WHERE id=attempt.device_id AND updated_at<=attempt.updated_at; END IF;
 END LOOP;
 RETURN true;
 END;$$`);
  await db.raw(`CREATE OR REPLACE FUNCTION public.lapse_push_batch() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE pref public.notification_preferences; items jsonb; devices jsonb; overrides jsonb; lease timestamptz;
 BEGIN
 SELECT p.* INTO pref FROM public.notification_preferences p JOIN public.master_users u ON u.id=p.user_id WHERE p.enabled=true AND u.is_active=true AND p.next_check_at<=clock_timestamp() AND EXISTS(SELECT 1 FROM public.notification_devices d WHERE d.user_id=p.user_id AND d.enabled AND d.token_version=u.token_version) ORDER BY p.next_check_at FOR UPDATE OF p SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 lease=clock_timestamp()+interval '2 minutes';
 UPDATE public.notification_preferences SET next_check_at=lease WHERE user_id=pref.user_id;
 SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) INTO items FROM(SELECT * FROM public.user_items WHERE user_id=pref.user_id AND expiry_type<>'NEVER' AND (pref.item_cursor IS NULL OR id>pref.item_cursor) ORDER BY id LIMIT 10)x;
 SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) INTO devices FROM(SELECT d.id FROM public.notification_devices d JOIN public.master_users u ON u.id=d.user_id WHERE d.user_id=pref.user_id AND d.enabled AND d.token_version=u.token_version ORDER BY d.id LIMIT 10)x;
 SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) INTO overrides FROM(SELECT item_id,mode,offsets FROM public.notification_item_preferences WHERE user_id=pref.user_id AND item_id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(items)))x;
 RETURN jsonb_build_object('preferences',to_jsonb(pref),'items',items,'devices',devices,'overrides',overrides,'lease',lease);
 END;$$`);
  await db.raw(`CREATE OR REPLACE FUNCTION public.lapse_push_finish(p_user uuid,p_lease timestamptz,p_cursor uuid,p_more boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 BEGIN
 UPDATE public.notification_preferences SET item_cursor=CASE WHEN p_more THEN p_cursor ELSE NULL END,next_check_at=CASE WHEN p_more THEN clock_timestamp() ELSE date_trunc('hour',clock_timestamp())+interval '1 hour' END WHERE user_id=p_user AND next_check_at=p_lease;
 RETURN FOUND;
 END;$$`);
  for (const signature of [
    'lapse_push_register(uuid,uuid,text,boolean,jsonb,integer)',
    'lapse_push_claim(jsonb)',
    'lapse_push_results(jsonb)',
    'lapse_push_batch()',
    'lapse_push_finish(uuid,timestamptz,uuid,boolean)',
  ]) {
    await db.raw(
      'REVOKE ALL ON FUNCTION public.' +
        signature +
        ' FROM PUBLIC, anon, authenticated',
    );
    await db.raw(
      'GRANT EXECUTE ON FUNCTION public.' + signature + ' TO service_role',
    );
  }
};
exports.down = async () => {
  throw new Error(
    'Use a reviewed forward migration; do not erase delivery history',
  );
};
