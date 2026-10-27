<?php
declare(strict_types=1);
if (!isset($action)) { http_response_code(404); exit; }
if ($action === 'work') {
    $f=filters();
    $items=work_items($f);
    $stage=$_GET['stage'] ?? ''; $type=$_GET['type'] ?? '';
    $items=array_values(array_filter($items,fn($r)=>(!$stage || ($stage==='overdue' ? $r['overdue'] : $r['stage']===$stage)) && (!$type || $r['type']===$type)));
    respond(['rows'=>$items,'total'=>count($items)]);
}
if ($action === 'team') {
    $f=filters(); $f['status']=''; $f['search']='';
    $f['active_only']=true;
    $items=work_items($f); $logs=module_rows('activities',$f,false)['rows'];
    $people=[];
    foreach (interns() as $person) {
        if (!$person['is_active']) { continue; }
        $owned=array_values(array_filter($items,fn($r)=>preg_match('/'.name_pattern($person['full_name']).'/iu',$r['people'])));
        $person['active']=count(array_filter($owned,fn($r)=>$r['stage']!=='completed'));
        $person['review']=count(array_filter($owned,fn($r)=>$r['stage']==='ready_for_review'));
        $person['logs']=count(array_filter($logs,fn($r)=>$r['employee_id']===$person['employee_id']));
        $people[]=$person;
    }
    respond(['work'=>$items,'people'=>$people,'recent'=>array_slice($logs,0,6)]);
}
if ($action === 'history') {
    if (!isset(modules()[$module])) { invalid('Unknown module.'); }
    $id=integer_value($_GET['id'] ?? '', 'Record ID',1,PHP_INT_MAX);
    // Snapshots stay server-side; return only the comment from the prior revision.
    $events=rows('SELECT history_id,action,editor,created_at,snapshot FROM work_history WHERE module=? AND record_id=? ORDER BY history_id DESC LIMIT 40',[$module,$id]);
    foreach($events as &$event){$snapshot=json_decode($event['snapshot'] ?? '{}',true);$event['comment']=$snapshot['_comment'] ?? '';unset($event['snapshot']);}unset($event);
    respond($events);
}
if ($action === 'undo') {
    $historyId=integer_value($input['history_id'] ?? '', 'History ID',1,PHP_INT_MAX);
    $pdo->beginTransaction();
    $events=rows('SELECT * FROM work_history WHERE history_id=? FOR UPDATE',[$historyId]);
    if (!$events || $events[0]['action']!=='deleted') { invalid('Only deleted records can be restored.'); }
    $event=$events[0]; $module=$event['module']; $id=(int)$event['record_id']; $m=modules()[$module];
    $latest=rows('SELECT MAX(history_id) AS id FROM work_history WHERE module=? AND record_id=?',[$module,$id])[0]['id'];
    if ((int)$latest !== $historyId || rows('SELECT '.$m['id'].' FROM '.$m['table'].' WHERE '.$m['id'].'=? FOR UPDATE',[$id])) { throw new RuntimeException('This record has already been restored or changed.',409); }
    $snapshot=json_decode($event['snapshot'],true,32,JSON_THROW_ON_ERROR);
    $allowed=[$m['id'],...$m['fields'],'created_at','updated_at']; if($module==='tasks'){$allowed[]='completed_at';}
    $data=array_intersect_key($snapshot,array_flip($allowed)); $columns=array_keys($data);
    execute_sql('INSERT INTO '.$m['table'].' ('.implode(',',$columns).') VALUES ('.implode(',',array_fill(0,count($columns),'?')).')',array_values($data));
    record_history($module,$id,'restored',null,$input);
    $pdo->commit(); respond(['module'=>$module,'id'=>$id]);
}
