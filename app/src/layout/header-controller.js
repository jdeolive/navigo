/* global angular */
'use strict';

angular.module('voyager.layout')
	.controller('HeaderCtrl', function(config, $rootScope, $scope, $modal, $window, $location, $stateParams, sugar, cartService, authService, savedSearchService, $state) {

		$scope.queue = {};
		$scope.login = _login;
		$scope.logout = _logout;
		$scope.showSavedSearch = _showSavedSearch;
		$scope.manageLink = config.root + 'manage';
		$scope.showClassicLink = false;
        $scope.showNav = $location.path() !== '/login';
        $scope.buildRev = '@build.revision@';
        $scope.mobileToggleClass = 'fa fa-bars';
		$scope.logo = config.root + 'pub/header.png';

		$scope.uiText = config.ui.navbar;

		if(angular.isDefined($location.search().disp)) {
			$scope.disp = '?disp=' + $location.search().disp;
		}


		$scope.$on('filterChanged', function () {
			if(angular.isDefined($location.search().disp)) {
				$scope.disp = '?disp=' + $location.search().disp;
			}
		});

        $rootScope.$on('$stateChangeStart', function(event, toState){
                $scope.showNav = toState.name !== 'login';
            });

		$scope.gotoPage = function(route) {
			$window.location.hash = route + '?disp=' + ($location.search().disp || 'default');
			$scope.toggleMobileNav();
		};

		$scope.clearQueue = function() {
			cartService.clear();
			$scope.$emit('removeAllCartEvent',{});
			$scope.toggleMobileNav();
		};

		$scope.toggleMobileNav = function() {
			if ($scope.navClass === '' || $scope.navClass === undefined) {
				$scope.navClass = 'full_width';
				$scope.mobileToggleClass = 'icon-x';
			} else {
				$scope.navClass = '';
				$scope.mobileToggleClass = 'fa fa-bars';
			}
		};

		_init();

		function _init() {
			//add queue observer
			cartService.addObserver(function(){
				_updateQueueTotal();
			});

			authService.addObserver(function(){
				_updateUserInfo();
			});

			$scope.$on('$stateChangeSuccess', _updateClassicLink);
		}

		function _updateClassicLink() {
			if (authService.hasPermission('manage')) {
				var path = $location.path();
				$scope.showClassicLink = (path.indexOf('/search') > -1 || path.indexOf('/show') > -1);
			} else {
				$scope.showClassicLink = false;
			}
		}

		function _logout() {
			authService.doLogout();
            //$window.location.reload();
            $state.go('login');
		}

		function _updateQueueTotal() {
			$scope.queueTotal = cartService.getCount() || '0';
		}

		function _updateUserInfo() {
			$scope.user = authService.getUser();
			$scope.canCart = authService.hasPermission('process');
			$scope.canManage = authService.hasPermission('manage');

			_updateClassicLink();

			if ($scope.canCart) {
				_updateQueueTotal(); //on initial load, update queue item
			}
		}

		function _showLoginDialog() {
			var modalInstance = $modal.open({
				templateUrl: 'common/security/login.html',
				size:'md',
				controller: 'AuthCtrl'
			});

			modalInstance.result.then(function () {

			}, function () {
				//$log.info('Modal dismissed at: ' + new Date());
			});

			$scope.toggleMobileNav();
		}

		function _login() {
			if (!$scope.loggedIn) {
				authService.checkAccess().then(function(hasAccess) {
					if(!hasAccess) {
						_showLoginDialog();
					}
				});
			} else {
				authService.doLogout($scope);
			}
		}

		function _showSavedSearch() {
			savedSearchService.showSearchModal('saved');
			$scope.toggleMobileNav();
		}

		$scope.goToClassic = function() {

			var params = $location.search();
			var baseUrl = config.root + config.explorePath + '/#/';

			if (params.view === 'card') {
				delete params.view;
			}

			params = sugar.retroParams(params);

			if ($location.path().indexOf('/search') === -1) {
				baseUrl += $location.path().replace('/show/', 'id=')  + '/';
			}

			$window.open(baseUrl + params, '_blank');
		};

	});
