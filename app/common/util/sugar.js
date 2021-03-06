/*global angular, $, _ */

angular.module('voyager.util').
    factory('sugar', function () {
        'use strict';

        function _convertExtent(val) {
            if(val.indexOf('bbox') >= 0) {
                val = val.replace(/["\)]/g, ""); //remove double quotes and right paren
                var bboxInfo = val.split('(');
                var mode = bboxInfo[0].replace('Is','').toUpperCase();
                mode = mode.replace('BBOX:','');
                var bbox = bboxInfo[1];
                return 'bbox=' + bbox + '/bbox.mode=' + mode;
            }
            return val;
        }

        function _cleanSlash(val) {
            var newVal = val.replace(/\\/g, "");  //remove all escape characters
            newVal = newVal.replace(/\//g, "\\/"); //but still need to escape forward slashes
            newVal = _convertExtent(newVal);
            return newVal;
        }

        function _removeFunk(params) {
            if (angular.isDefined(params.fq)) {
                if (angular.isArray(params.fq)) {
                    $.each(params.fq, function (index, value) {
                        params.fq[index] = _cleanSlash(value);
                    });
                } else {
                    params.fq = _cleanSlash(params.fq);
                }
            }
        }

        function _separateOr(value) {
            var separated = value.substring(value.indexOf('}')+1), sep='';
            var parenStart = separated.indexOf('(');
            if (parenStart !== -1) {
                var filter = separated.substring(0, parenStart);
                var facets = separated.substring(parenStart+1, separated.indexOf(')'));
                facets = facets.split(' ');
                separated = '';
                _.each(facets, function(val) {
                    separated += sep + filter + val;
                    sep = '&fq=';
                });
            }
            return separated;
        }

        return {

            retroParams: function (params) {
                _removeFunk(params);
                var retro = $.param(params, true);
                retro = retro.replace(/\+/g, " ");
                retro = retro.replace(/ /g, "%20");
                //params = params.replace(/[\s\/\+\-!\(\){}\^"~*?:]|&&|\|\|/g, "\\$&");
                retro = retro.replace(/\\/g, "");
                retro = retro.replace(/&/g, '/');
                retro = retro.replace(/%3A/g, ':');
                //params = params.replace(/%5C/g, '');
                retro = retro.replace(/%5C%2F/g, '%252F');
                retro = retro.replace(/fq=/g, 'f.');
                retro = retro.replace('f.path', 'path');
                retro = retro.replace('f.bbox', 'bbox');
                retro = retro.replace(/:/g, '=');
                return retro;
            },

            bytesToSize: function (bytes) {
                var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                if (bytes === 0) {
                    return '0 Bytes';
                }
                var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
                return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
            },

            toArray: function (val) {
                if (typeof val === 'string') {
                    return [ val ];
                } else if (_.isUndefined(val)) {
                    return [];
                }
                return val.slice();
            },

            toMap: function(key, array) {
                var map = {};
                $.each(array, function (index, value) {
                    map[value[key]] = value;
                });
                return map;
            },

            hasField: function(list,field) {
                var has = false;
                $.each(list, function( index, item ) {
                    has = angular.isDefined(item[field]);
                    return !has;  //false kills the loop
                });
                return has;
            },

            trim: function(val, toTrim) {
                if (val.lastIndexOf(toTrim) === val.length-1) {
                    val = val.substring(0,val.length-1);
                }
                if (val.indexOf(toTrim) === 0) {
                    val = val.substring(1);
                }
                return val;
            },

            getIndex: function(array, val) {
                var i = 0;
                for (i; i < array.length; i++) {
                    if (array[i].indexOf(val) > -1) {
                        return i;
                    }
                }
                return -1;
            },

            toQueryString: function(params) {
                var queryString = '';
                var sep = '';
                $.each(params,function(key, value) {
                    if($.isArray(value)) {
                        $.each(value, function(index, val) {
                            queryString += sep + key + '=' + val;
                            sep = '&';
                        });
                    } else {
                        queryString += sep + key + '=' + value;
                        sep = '&';
                    }
                });
                return queryString;
            },

            toQueryStringEncoded: function(params) {
                var queryString = '';
                var sep = '';
                $.each(params,function(key, value) {
                    if($.isArray(value)) {
                        $.each(value, function(index, val) {
                            queryString += sep + key + '=' + encodeURIComponent(val);
                            sep = '&';
                        });
                    } else {
                        queryString += sep + key + '=' + encodeURIComponent(value);
                        sep = '&';
                    }
                });
                return queryString;
            },

            //TODO this just removes or filters, the disp config will apply as or filters if filters are CHECK style
            toNavigoQueryString: function(params) {
                var queryString = '';
                var sep = '', filterValue;
                $.each(params,function(key, value) {
                    if($.isArray(value)) {  // OR filters shouldn't be in an array
                        $.each(value, function(index, val) {
                            queryString += sep + key + '=' + val;
                            sep = '&';
                        });
                    } else {
                        filterValue = value;
                        if (filterValue.indexOf('{!tag=') !== -1) {
                            filterValue = _separateOr(filterValue);
                        }
                        queryString += sep + key + '=' + filterValue;
                        sep = '&';
                    }
                });
                return queryString;
            },

            copy: function(value) {
                return JSON.parse(JSON.stringify(value));
            },

            decodeParams: function(params) {
                $.each(params, function(index, param) {
                    if( typeof param === 'string' ) {
                        params[index] = decodeURIComponent(param);
                    } else {  //array
                        $.each(param, function(index, value) {
                            param[index] = decodeURIComponent(value);
                        });
                    }
                });
            },

            formatBBox: function(bbox) {
                var bboxRange = bbox.split(' ');

                _.each(bboxRange, function(item, index){
                    bboxRange[index] = Number(item).toFixed(2);
                });

                return bboxRange.join(' ');
            }

        };
    });



