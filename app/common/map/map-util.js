/*global angular, _, L, Wkt, alert, $ */

angular.module('voyager.map').
    factory('mapUtil', function (leafletData, config, $timeout) {

        'use strict';

        function _getBounds(bbox) {
            bbox = bbox.replace(/,/g, ' ');
            var bboxCoords = bbox.split(' ');
            var recStart = {'lat': bboxCoords[3], 'lng': bboxCoords[0]},
                recEnd = {'lat': bboxCoords[1], 'lng': bboxCoords[2]};
            return [recStart, recEnd];
        }

        var _defaultConfig = {
            //tileLayer: "http://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}/",
            attributionControl: false,
            scrollWheelZoom: true,
            zoomControl: false,
//            noWrap: true,
//            continuousWorld: false,
            minZoom: 1
        };

        var _layers = {
            baselayers: {
                base: {
                    name: 'arcgis',
                    type: 'xyz',
                    url: 'http://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}/',
                    layerParams: {
//                        noWrap: true,
//                        continuousWorld: false
                    }
                }
            }
        };

        var baseMap = _.getPath(config, 'map.config.url');
        if(angular.isDefined(baseMap)) {
            if(config.map.type === 'WMSLayerDefinition') {
                delete _defaultConfig.tileLayer;
                _defaultConfig.crs = 'EPSG4326';
                _layers = {
                    baselayers: {
                        base: {
                            name: config.map.config.name,
                            type: 'wms',
                            url: baseMap,
                            layerOptions: {
                                layers: config.map.config.layers
                            },
                            layerParams: {
//                                noWrap: true,
//                                continuousWorld: false
                            }
                        }
                    }
                };
            } else if (config.map.type === 'MapboxLayerDefinition') {
                _layers.baselayers.base.url = baseMap.replace(/\$/g, '');  //remove $ needed for OL (classic) map
            } else {
                if(config.map.config.cached === true) {
                    _layers.baselayers.base.url = baseMap + 'tile/{z}/{y}/{x}/';
                    if(config.map.config.simpleWGS84) {
                        // custom crs - snagged from leaflet 1.0 to support 4326 better
                        var wgs84Proj = L.extend({}, L.Projection.LonLat, {bounds:L.bounds([-180, -90], [180, 90])});
                        var wgs84 = L.extend({}, L.CRS, {
                            projection: wgs84Proj,
                            transformation: new L.Transformation(1 / 180, 1, -1 / 180, 0.5),
                            getSize: function (zoom) {
                                var b = this.projection.bounds,
                                    s = this.scale(zoom),
                                    min = this.transformation.transform(b.min, s),
                                    max = this.transformation.transform(b.max, s);

                                return L.point(Math.abs(max.x - min.x), Math.abs(max.y - min.y));
                            }
                        });
                        _defaultConfig.crs = wgs84;
                    }
                } else {
                    //TODO not sure what to do here, will use default arcgis for now
                    config.hasMapError = true;
                    //_layers.baselayers.base.url = baseMap;
                }
            }
        }

        function _getStyle(type, weight) {
            var color = config.searchMap.footprintColor;
            var _weight = config.searchMap.footprintWidth;
            if (angular.isDefined(type)) {
                color = (type.toLowerCase() === 'within') ? '#f06eaa' : '#1771b4';
                _weight = 1;
            }
            if (angular.isDefined(weight)) {
                _weight = weight;
            }
            return {color:color, weight:_weight};
        }

        return {
            getDefaultConfig: function() { return _defaultConfig;},

            getLayers: function(origin) {
                if(origin === 'home') {
                    var homeLayer = _.clone(_layers, true);
                    if (config.homepage.wrapMap === false) {
                        homeLayer.baselayers.base.layerParams.noWrap = true;
                    }
                    return homeLayer;
                }
                return _layers;
            },

            getRectangle: function(bbox, type, weight) {
                var bounds = _getBounds(bbox), style = _getStyle(type, weight);
                return L.rectangle(bounds, {color: style.color, weight: style.weight, fill:false});
            },

            getPolygon: function(geo, type, weight) {
                var style = _getStyle(type, weight);
                return L.polygon(geo.coordinates[0], {color: style.color, weight: style.weight, fill:false});
            },

            getGeoJson: function(geo, type, weight) {
                var style = _getStyle(type, weight);
                var isPoint = geo.type === 'Point' || geo.type === 'MultiPoint';
                return L.geoJson(geo, {
                    style: {
                        color: style.color,
                        weight: isPoint?0:style.weight,
                        opacity: 0.65,
                        fill: isPoint,
                        fillOpacity: 0.65
                    },
                    pointToLayer: function(f, ll) {
                        return L.circleMarker(ll, {
                            radius: 6,
                            fillColor: style.color
                        });
                    }
                });
            },

            drawBBox: function (map, bbox, fit, type) {
                var box = this.getRectangle(bbox, type, 3);
                map.addLayer(box);
                if (fit) {
                    map.fitBounds(_getBounds(bbox));
                }
                return box;
            },

            drawPolygon: function (map, geo, fit, type) {
                var polygon = this.getPolygon(geo, type, 3);
                map.addLayer(polygon);
                if (fit) {
                    map.fitBounds(polygon.getBounds());
                }
                return polygon;
            },

            drawGeoJson: function (map, geo, fit, type) {
                var geoJson = this.getGeoJson(geo, type, 3);
                map.addLayer(geoJson);
                if (fit) {
                    $timeout(function() {
                        var bounds = geoJson.getBounds();
                        map.currentBounds = bounds;  //flag so resize event doesn't override
                        map.fitBounds(bounds);
                    });
                }
                return geoJson;
            },

            fitToBBox: function (map, bbox) {
                map.fitBounds(_getBounds(bbox));
            },

            getWkt: function (args) {
                var wkt = new Wkt.Wkt();
                try { // Catch any malformed WKT strings
                    wkt.read(args);
                } catch (e1) {
                    try {
                        wkt.read(args.replace('\n', '').replace('\r', '').replace('\t', ''));
                    } catch (e2) {
                        if (e2.name === 'WKTError') {
                            alert('Wicket could not understand the WKT string you entered. Check that you have parentheses balanced, and try removing tabs and newline characters.');
                            return;
                        }
                    }
                }
                return wkt.toObject({}); // Make an object
            },
            moveMapTo: function (wktObj, map) {
                if (wktObj.getBounds !== undefined && typeof wktObj.getBounds === 'function') {
                    // For objects that have defined bounds or a way to get them
                    var height = $(map.getContainer()).height();
                    if (height > 0) {  //map freezes when setting bounds if container isn't shown yet
                        map.fitBounds(wktObj.getBounds());
                    } else {
                        map.moveToLater = wktObj.getBounds();
                    }
                } else {
                    if (wktObj.getLatLng !== undefined && typeof wktObj.getLatLng === 'function') {
                        map.panTo(wktObj.getLatLng());
                    }
                }
            },
            // ** just info on bbox and extent since leaflet has no concept of extent and minx etc **
            // toBBoxString = 'southwest_lng,southwest_lat,northeast_lng,northeast_lat'
            // northEast = new google.maps.LatLng(maxY, maxX);
            // southWest = new google.maps.LatLng(minY, minX);
            // bbox = left,bottom,right,top
            // bbox = min Longitude , min Latitude , max Longitude , max Latitude
            setExtent: function (map, param) {
                var bounds = map.getBounds();
                param.extent = bounds.toBBoxString().replace(/,/g, ' ');
                var center = bounds.getCenter();
                param.center = center.lat + ' ' + center.lng;
                param.zoom = map.getZoom();
            },
            startDraw: function (e, mapId) {
                leafletData.getMap(mapId).then(function (map) {
                    var options = {shapeOptions: {strokeOpacity: 0.8, fillOpacity: 0.0}, showArea: false};
                    if (e.target.id === 'clip-rectangle') {
                        new L.Draw.Rectangle(map, options).enable();
                    } else {
                        var polygon = new L.Draw.Polygon(map, options);
                        polygon.enable();
                    }
                });
            },
            getBounds: function(bbox) {
                return _getBounds(bbox);
            },

            isBbox: function(value) {
                var isBbox = false;
                if (_.isString(value) && !_.isEmpty(value)) {
                    var coords = value.split(' ');
                    var nonNumeric = _.find(coords, function(val) {
                        return isNaN(val);
                    });
                    if(angular.isUndefined(nonNumeric)) {
                        isBbox = true;
                    }
                }
                return isBbox;
            }
        };

    });
