<?php
// Router for PHP's local development server; Apache uses the .htaccess files.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
if (preg_match('~(?:^|/)(?:\.|config(?:/|$)|includes(?:/|$)|scripts(?:/|$)|database(?:/|$)|storage(?:/|$)|tests(?:/|$)|README\.md$)~i', $path)) {
    http_response_code(404); exit;
}
return false;
