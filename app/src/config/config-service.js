'use strict';
angular.module('voyager.config').
    factory('configService', function (config, translateService, $http, $q, catalogService, $location) {
        var _configId = null;
        var _systemFilters = null;
        var _systemFilterMap = {};
        var _displayFields = {};
        var _summaryFields = {};
        var _solrParams = '';
        var _summarySolrParams = '';
        var _tableFields = [];
        var _displayFieldsOrder = {};
        var _displayFieldsStyle = {};
        var _summaryFieldsOrder = {};
        var _summaryFieldsStyle = {};
        var _tableColumnWidthMap = {};
        var _shards = null;
        var _homepage = {};
        var _editable = {};
        var _defaultMapView = {lng: 0, lat: 0, zoom: 3};
        var _catalogsPromise;

        function _setConfigFields(displayFields) {
            $.each(displayFields, function (index, value) {
                _displayFields[value.name] =  translateService.getFieldName(value.name);
                _displayFieldsOrder[value.name] = index;
                _displayFieldsStyle[value.name] = value.style;
                _solrParams += ',' + value.name;
                if (value.editable) {
                    _editable[value.name] = value.name;
                }
            });
        }

        function _setSummaryFields(summaryFields) {
            $.each(summaryFields, function (index, value) {
                _summaryFields[value.name] =  translateService.getFieldName(value.name);
                _summaryFieldsOrder[value.name] = index;
                _summaryFieldsStyle[value.name] = value.style;
                _summarySolrParams += ',' + value.name;
            });
        }

        function _setTableFields(table) {
            _tableFields = [];
            $.each(table, function (index, value) {
                var tableField = {field:value.field, display:translateService.getFieldName(value.field), width: value.width};
                _tableFields.push(tableField);
                if(angular.isDefined(value.width)) {
                    _tableColumnWidthMap[value.field] = {value:parseFloat(value.width)};
                }
            });
        }

        function _updateConfig(configData) {
            _shards = null;
            _systemFilterMap = _.indexBy(configData.filters, 'field');
            _setConfigFields(configData.display.fields);
            _homepage = configData.homepage;
            if(configData.summary) {
                _setSummaryFields(configData.summary.fields);
            } else {
                _summaryFields = {};
                _summarySolrParams = '';
                _summaryFieldsOrder = {};
                _summaryFieldsStyle = {};
            }
            if(angular.isDefined(configData.table)) {
                _setTableFields(configData.table);
            }
        }

        try {
            _updateConfig(config.settings.data);
        } catch(err) {
            //console.log(err);
        }

        function _setFilterDataTypes() {
            var filterString = _.keys(_systemFilterMap).join(' ');

            return $http.jsonp(config.root + 'solr/fields/select?q=name:(' + filterString + ')&fl=name,multivalued,disp:disp_en,stype&wt=json&json.wrf=JSON_CALLBACK&rows=1000').then(function(filterData){
                _.each(filterData.data.response.docs, function(doc) {
                    var filter = _systemFilterMap[doc.name];
                    filter.stype = doc.stype;
                    filter.multivalued = doc.multivalued;
                    filter.disp = doc.disp;
                });
            });
        }

        function _load(configId) {
            return $http.get(config.root + 'api/rest/display/config/' + configId + '.json').then(function (res) {
                _configId = configId;
                config.settings = res;
                _updateConfig(config.settings.data);

                return _setFilterDataTypes().then(function() {
                    return config.settings.data;
                });

            });
        }

        function _setDefaultConfig() {
            if(_configId !== null) {
                _configId = null;
                return _load(config.configid).then(function() {
                    $location.search('disp', config.configid);
                    return {configId: config.configid};
                });
            } else {
                //TODO what if _load failed (bad config 404) settings won't be set
                if(config.settings) {
                    _updateConfig(config.settings.data);
                    return $q.when({configId: config.configid});
                } else {  //no settings set, load "default" config
                    return _load(config.configid).then(function() {
                        $location.search('disp', config.configid);
                        return {configId: config.configid};
                    }, function(error) {
                        //failed to set "default" config, now what?
                        return $q.reject(error);
                    });
                }
            }
        }

        function _setFilterConfig(configId) {
            var deferred = $q.defer();
            if(configId === _configId) {  //don't reload same config
                deferred.resolve({configId: configId});
            }
            //var configId = params['voyager.config.id'];
            else if (angular.isDefined(configId)) {
                _load(configId).then(function() {
                    deferred.resolve({configId: configId});
                }, function() { //probably 404, invalid config
                    _setDefaultConfig().then(function(config) {
                        deferred.resolve(config);
                    });
                });
            } else {  //reset to default
                _setDefaultConfig().then(function(config) {
                    deferred.resolve(config);
                });
            }
            return deferred.promise;
        }

        function _createCatalogFacet(catalog, urlShards) {
            var selected = _.indexOf(urlShards, catalog.id);
            return {display: catalog.name, style: 'CHECK', isSelected: selected !== -1, field: 'shard', hasCount: false, id: catalog.id, raw: catalog.url};
        }

        function _createCatalogFilter(catalogFilter, facetTypes) {
            if (!catalogFilter) {
                catalogFilter = {field: 'shards', value: 'Catalog', values: []};
                facetTypes.unshift(catalogFilter);
            }
            catalogFilter.value = 'Catalog';
            var urlShards = $location.search().shards;
            urlShards = urlShards.split(',');
            _catalogsPromise = catalogService.fetch().then(function (catalogs) {
                var selectedCount = 0;
                _.each(catalogs, function (catalog) {
                    var facet = _createCatalogFacet(catalog, urlShards);
                    catalogFilter.values.push(facet);
                    if (facet.isSelected) {
                        selectedCount++;
                    }
                });
                if (selectedCount === 1) {  //if only 1 selected, disable it so one has to always be selected
                    var filter = _.find(catalogFilter.values, {isSelected: true});
                    filter.disabled = true;
                }
                return;
            });
        }

        return {

            getDisplayFilters: function () {
                //facetTypes are filters
                var facetTypes = config.settings.data.filters, hasShard = false, catalogFilter;
                $.each(facetTypes, function (index, value) {
                    value.value = '';
                    value.values = [];  //facets
                    if(value.style === 'HIERARCHY') {
                        value.value = translateService.getFieldName(value.field);
                    }
                    if(value.field === 'shards') {
                        hasShard = true;
                        catalogFilter = value;
                    }
                });

                translateService.translateFilterNames(facetTypes);
                if(config.settings.data.showFederatedSerach && angular.isDefined($location.search().shards)) {
                    _createCatalogFilter(catalogFilter, facetTypes);
                }
                return facetTypes;
            },

            getDisplay: function() {
                return config.settings.data;
            },

            lookupFilter: function(filter) {
                return _systemFilterMap[filter];
            },

            lookupFilterStyle: function(filterName) {
                var filterConfig = this.lookupFilter(filterName);
                if (angular.isDefined(filterConfig)) {
                    if (filterConfig.stype === 'date') {
                        return 'DATE';
                    } else {
                        return filterConfig.style;
                    }
                } else {
                    return '';
                }
            },

            getSystemFilters: function() {
                return _systemFilters;
            },

            getFilters: function () {
                return config.settings.data.filters;
            },

            setConfigId: function (configId) {
                _configId = configId;
            },

            getConfigId: function () {
                if(_configId !== null) {
                    return _configId;
                } else if(angular.isDefined(config.defaultId)) {
                    return config.defaultId; //set if there is a default saved search
                } else {
                    return config.configid;  //default config.js id
                }
            },

            setFilterConfig: function(configId) {
                return _setFilterConfig(configId);
            },

            getConfigDetails: function(id) {
                return $http.get(config.root + 'api/rest/display/config/' + id + '.json');
            },

            getSolrFields: function() {
                if(_summarySolrParams !== '') {
                    return _summarySolrParams;
                }
                return _solrParams;
            },

            getDisplayFields: function(doc) {
                var prettyFields = [], fields, order, style;

                fields = _displayFields;
                order = _displayFieldsOrder;
                style = _displayFieldsStyle;

                if(!_.isEmpty(_summaryFields)) {
                    fields = _summaryFields;
                    order = _summaryFieldsOrder;
                    style = _summaryFieldsStyle;
                }
                $.each(doc, function (name, value) {
                    if (fields[name]) {
                        if(_.isArray(value )) {
                            value = value.join(', ');
                        }
                        prettyFields.push({'name': fields[name], 'value': value, order: order[name], style: style[name], raw: name});
                    }
                });

                return _.sortBy(prettyFields,'order');
            },

            getTableFields: function() {
                return _tableFields;
            },

            getTableFieldNames: function() {
                return _.map(_tableFields, 'field');
            },

            updateColumnWidth: function(field, value) {
                _tableColumnWidthMap[field] = {changed:true, value:value};
            },

            getColumnWidth: function(field) {
                var col = _tableColumnWidthMap[field];
                if(angular.isDefined(col)) {
                    return col.value;
                }
                return col;
            },

            resetColumns: function() {
                $.each(_tableFields, function(index, field) {
                    if(angular.isDefined(field.width)) {
                        _tableColumnWidthMap[field.field] = {value:parseFloat(field.width)};
                    }
                });
            },

            hasChanges: function() {
                return !_.isEmpty(_tableColumnWidthMap);
            },

            getUpdatedSettings: function() {
                var colInfo;
                $.each(config.settings.data.table, function(index, column) {
                    colInfo = _tableColumnWidthMap[column.field];
                    if(angular.isDefined(colInfo)) {
                        column.width = colInfo.value;
                    }
                });
                return config.settings.data;
            },


            getSort: function() {
                var sort = {};
                sort.direction = angular.isDefined(config.defaultSortDirection)? config.defaultSortDirection : 'desc';
                sort.field = angular.isDefined(config.defaultSort)? config.defaultSort : 'score';
                return sort;
            },

            showMap: function() {
                var showMap = config.settings.data.display.showMap;
                if (angular.isUndefined(showMap)) {
                    showMap = true; //default
                }
                return showMap;
            },

            getSortable: function() {
                var sortable = [];
                if(angular.isDefined(config.settings.data.sortable)) {
                    $.each(config.settings.data.sortable, function(index, field) {
                        sortable.push({key:field, value:translateService.getFieldName(field)});
                    });
                }
                return sortable;
            },

            setShards: function(shards) {
                _shards = shards;
            },

            getShards: function() {
                return _shards;
            },

            getHomePage: function() {
                return _homepage;
            },

            getEditable: function() {
                return _editable;
            },

            getDefaultMapView: function() {
                return _defaultMapView;
            },

            /**
             * @param mapView Object with lng, lat, and zoom properties.
             */
            setDefaultMapView: function(mapView) {
                _defaultMapView = mapView;
            },

            /**
             * Parse view string.
             *
             * @param str as "longitude, latitude[, zoom]" pair/ triple.
             * @param delim is optional, defaults to comma
             */
            parseMapViewString: function(str, delim) {
                var coords = str.split(_.isEmpty(delim)?',':delim);
                coords = _.map(coords, function(val) {return parseFloat(val);});
                var view = {
                    lng: 0,
                    lat: 0,
                    zoom: 3
                };
                if (coords.length > 1) {
                    view.lng = coords[0];
                    view.lat = coords[1];
                }
                if (coords.length > 2) {
                    view.zoom = coords[2];
                }
                return view;
            },
            getCatalogs: function() {
                return _catalogsPromise;
            }
        };

    });
