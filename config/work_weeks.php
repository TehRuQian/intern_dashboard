<?php
// Confirmed by the user: 22 October 2026 is Thursday, the start of WW45.
// Map labels relative to that anchor; do not infer ISO weeks or other week-years.
$anchor = new DateTimeImmutable('2026-10-22');
$weeks = [];
for ($week = 1; $week <= 54; $week++) {
    $start = $anchor->modify(sprintf('%+d days', ($week - 45) * 7));
    $weeks[$week] = ['start' => $start->format('Y-m-d'), 'end' => $start->modify('+6 days')->format('Y-m-d')];
}
return [2026 => $weeks];
