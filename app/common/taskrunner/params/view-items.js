/*global angular, $, _, Sugar*/
/* this is used on the task tab/page so the items param gets set correctly from the url params, when not displayed */

angular.module('taskRunner')
    .directive('vsViewItems', function () {
        'use strict';

        return {
            templateUrl: 'common/taskrunner/params/view-items.html',
            controller: function ($scope) {
                $scope.items = $scope.param.response.docs;
            }
        };
    });