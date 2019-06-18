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


$( document ).ready(function() {
    var searchAttr = 'data-search-mode';
    jQuery.expr[':'].Contains = function(a,i,m){
        return (a.textContent || a.innerText || "").toUpperCase().indexOf(m[3].toUpperCase())>=0;
    };
    //on search
    $("#nav-search").on("keyup", function(event) {
        var search = $(this).val();

        if (!search) {
            //no search, show all results
            document.documentElement.removeAttribute(searchAttr);
            $("nav > ul > li").not('.level-hide').show();

            if(typeof hideAllButCurrent === "function"){
                //let's do what ever collapse wants to do
                hideAllButCurrent();
            }
            else{
                //menu by default should be opened
                $("nav > ul > li > ul li").show();
            }
        }
        else{
            //we are searching
            document.documentElement.setAttribute(searchAttr, '');

            //show all parents
            $("nav > ul > li").show();
            //hide all results
            $("nav > ul > li > ul li").hide();
            //show results matching filter
            $("nav > ul > li > ul").find("a:Contains("+search+")").parent().show();
            //hide parents without children
            $("nav > ul > li").each(function(){
                if($(this).find("a:Contains("+search+")").length == 0 && $(this).children("ul").length === 0){
                    //has no child at all and does not contain text
                    $(this).hide();
                }
                else if($(this).find("a:Contains("+search+")").length == 0 && $(this).find("ul").children(':visible').length == 0){
                    //has no visible child and does not contain text
                    $(this).hide();
                }
            });
        }
    });
});