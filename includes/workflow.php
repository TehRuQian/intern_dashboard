<?php
declare(strict_types=1);

function decorate_record(string $module, array $r): array {
    $id = (int)$r[modules()[$module]["id"]];
    $r["_revision"] = (int)rows("SELECT COALESCE(MAX(history_id),0) AS revision FROM work_history WHERE module=? AND record_id=?", [$module,$id])[0]["revision"];
    return $r;
}
function record_history(string $module, int $id, string $action, ?array $snapshot, array $input): int {
    $editor = text_field($input['editor'] ?? '', 'Updated by', 100) ?? 'Team member';
    $snapshot=$snapshot ?? [];
    $snapshot['_comment']=text_field($input['comment'] ?? '', 'Comment',4000) ?? '';
    execute_sql('INSERT INTO work_history (module,record_id,action,editor,snapshot) VALUES (?,?,?,?,?)', [$module,$id,$action,$editor,json_encode($snapshot)]);
    return (int)$GLOBALS['pdo']->lastInsertId();
}
function sync_work_completion(string $module, array $data, ?array $existing): array {
    if (!in_array($module, ['tasks', 'projects'], true)) { return $data; }
    $status = modules()[$module]['status'];
    // A progress-only edit can reopen a completed record.
    if ($existing && $existing[$status] === 'completed' && $data[$status] === 'completed'
        && (int)$data['progress_percent'] !== (int)$existing['progress_percent'] && (int)$data['progress_percent'] < 100) {
        $data[$status] = 'in_progress';
    } elseif ($data[$status] === 'completed') {
        $data['progress_percent'] = 100;
    } elseif ((int)$data['progress_percent'] === 100) {
        $data[$status] = 'completed';
    }
    if ($module === 'projects' && $data[$status] === 'completed') { $data['review_status'] = 'approved'; }
    elseif ($module === 'projects' && $existing && $existing[$status] === 'completed' && $data['review_status'] === 'approved') { $data['review_status'] = 'pending'; }
    return $data;
}
function work_stage(string $module, array $r): string {
    $status = $r[modules()[$module]['status']];
    if ($module === 'projects' && $r['review_status'] === 'in_review') { return 'ready_for_review'; }
    return ['pending'=>'not_started','not_started'=>'not_started','ready_for_review'=>'ready_for_review','completed'=>'completed'][$status] ?? 'in_progress';
}
function work_items(array $f): array {
    $f['status'] = ''; $result = [];
    // Source-specific sort keys are not applicable to the unified list.
    $sort = $_GET['sort'] ?? null; unset($_GET['sort']);
    try {
        foreach (['tasks','projects'] as $module) {
            foreach (module_rows($module, $f, false)['rows'] as $r) {
                $m = modules()[$module];
                $result[] = ['module'=>$module,'id'=>$r[$m['id']],'title'=>$r[$module === 'projects' ? 'project_name':'task_title'],
                    'people'=>$r[$m['pic']], 'type'=>$module==='projects'?'system_development':'special_task',
                    'stage'=>work_stage($module,$r), 'due_date'=>$r['due_date'], 'assigned_date'=>$r['assigned_date'],
                    'progress'=>$r['progress_percent'], 'overdue'=>!empty($r['due_date']) && $r['due_date']<date('Y-m-d') && work_stage($module,$r)!=='completed'];
            }
        }
    } finally { if ($sort !== null) { $_GET['sort'] = $sort; } }
    $source=$_GET['source'] ?? ''; $stage=$_GET['stage'] ?? '';
    if(!in_array($source,['','tasks','projects'],true)){invalid('Choose a valid task sheet.');}
    $result=array_values(array_filter($result,fn($r)=>(!$source||$r['module']===$source)&&(!$stage||($stage==='overdue'?$r['overdue']:$r['stage']===$stage))));
    usort($result, fn($a,$b)=>strcmp($b['assigned_date'] ?? '',$a['assigned_date'] ?? '') ?: $b['id']<=>$a['id']);
    return $result;
}
