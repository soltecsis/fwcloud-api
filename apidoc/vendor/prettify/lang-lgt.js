/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


/*

 Copyright (C) 2014 Paulo Moura

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
PR.registerLangHandler(PR.createSimpleLexer([["str",/^\"(?:[^\"\\\n\x0C\r]|\\[\s\S])*(?:\"|$)/,null,'"'],["lit",/^[a-z][a-zA-Z0-9_]*/],["lit",/^\'(?:[^\'\\\n\x0C\r]|\\[^&])+\'?/,null,"'"],["lit",/^(?:0'.|0b[0-1]+|0o[0-7]+|0x[\da-f]+|\d+(?:\.\d+)?(?:e[+\-]?\d+)?)/i,null,"0123456789"]],[["com",/^%[^\r\n]*/,null,"%"],["com",/^\/\*[\s\S]*?\*\//],["kwd",/^\s*:-\s(c(a(lls|tegory)|oinductive)|p(ublic|r(ot(ocol|ected)|ivate))|e(l(if|se)|n(coding|sure_loaded)|xport)|i(f|n(clude|itialization|fo))|alias|d(ynamic|iscontiguous)|m(eta_(non_terminal|predicate)|od(e|ule)|ultifile)|reexport|s(et_(logtalk|prolog)_flag|ynchronized)|o(bject|p)|use(s|_module))/],
["kwd",/^\s*:-\s(e(lse|nd(if|_(category|object|protocol)))|built_in|dynamic|synchronized|threaded)/],["typ",/^[A-Z_][a-zA-Z0-9_]*/],["pun",/^[.,;{}:^<>=\\/+*?#!-]/]]),["logtalk","lgt"]);
