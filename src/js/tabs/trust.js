var util = require('util');
var webutil = require('../util/web');
var Tab = require('../client/tab').Tab;
var Currency = ripple.Currency;
var fs = require('fs');

var TrustTab = function ()
{
  Tab.call(this);

};

util.inherits(TrustTab, Tab);

TrustTab.prototype.tabName = 'trust';
TrustTab.prototype.mainMenu = 'fund';

TrustTab.prototype.generateHtml = function () {
  return require('../../templates/tabs/trust.jade')();
};

TrustTab.prototype.angular = function (module) {
  module.controller('TrustCtrl', ['$scope', 'rpBooks', '$timeout',
    '$routeParams', 'rpId', '$filter', 'rpNetwork', 'rpKeychain', 'rpApi',
    function ($scope, books, $timeout, $routeParams, id, $filter,
      $network, keychain, api) {

      if (!id.loginStatus) {
        id.goId();
      }

      // Used in offline mode
      if (!$scope.fee) {
        $scope.fee = Number(Options.max_tx_network_fee);
      }

      var RemoteFlagDefaultRipple = 0x00800000;
      var AuthEnabled = 0x00040000;
      $scope.advanced_feature_switch = Options.advanced_feature_switch;
      $scope.trust = {};

      // Trust line sorting
      $scope.sorting = {
        predicate: 'balance',
        reverse: true,
        sort: function(line) {
          return $scope.sorting.predicate === 'currency' ?
            line.currency : line.balance.to_number();
        }
      };

    $scope.saveTransaction = function(tx) {
      var sequenceNumber = (Number(tx.tx_json.Sequence));
      var sequenceLength = sequenceNumber.toString().length;
      var txnName = $scope.userBlob.data.account_id + '-' + new Array(10 - sequenceLength + 1).join('0') + sequenceNumber + '.txt';
      var txData = JSON.stringify({
        tx_json: tx.tx_json,
        hash: $scope.hash,
        tx_blob: $scope.signedTransaction
      });
      var fileName = $scope.userBlob.data.defaultDirectory + '/' + txnName;
      fs.writeFile(fileName, txData, function(err) {
        $scope.$apply(function() {
          $scope.fileName = fileName;
          console.log('saved file');
          if (err) {
            console.log('Error saving transaction: ', JSON.stringify(err));
            $scope.error = true;
          } else {
            $scope.saved = true;
          }
        });
      });
    };

      $scope.reset = function () {
        $scope.mode = 'main';
        $scope.addform_visible = false;
        $scope.edituser = '';
        $scope.counterparty = '';
        $scope.counterparty_view = '';
        $scope.counterparty_address = '';
        $scope.saveAddressName = '';
        $scope.error_account_reserve = false;
      };

      $scope.toggle_form = function () {

        if ($scope.addform_visible) {
          $scope.reset();
        } else {
          $scope.addform_visible = true;
        }
      };


      // User should not be able to grant trust if the reserve is insufficient
      $scope.$watch('account', function() {
        $scope.acctDefaultRippleFlag = ($scope.account.Flags & RemoteFlagDefaultRipple);
        // Allow user to set auth on a trustline only if their account has auth enabled
        $scope.disallowAuth = !($scope.account.Flags & AuthEnabled);
        // Client is online and RequireAuth is not set on account root
        if ($scope.onlineMode && $scope.disallowAuth) {
          $scope.setAuthMessage = 'This account has not enabled authorization, '
          + 'so there is no need to set authorization on a trustline.';
        } else if ($scope.onlineMode) {
          // Client is online and ReqireAuth is set on account root
          $scope.setAuthMessage = 'Authorize the other party to hold '
          + 'issuances from this account.';
        } else {
          // Client is not online, don't know if RequireAuth is set
          // so allow user to set flag
          $scope.setAuthMessage = 'Authorize the other party to hold '
          + 'issuances from this account. You must have the RequireAuth flag enabled in Gateways and trust lines.';
        }

        $scope.can_add_trust = false;
        if (!$scope.onlineMode) {
          $scope.can_add_trust = true;
        } else if ($scope.account.Balance && $scope.account.reserve_to_add_trust) {
          if (!$scope.account.reserve_to_add_trust.subtract($scope.account.Balance).is_positive()
            || $.isEmptyObject($scope.lines)) {
            $scope.can_add_trust = true;
          }
        }
      }, true);

      $scope.$watch('counterparty', function() {
        $scope.error_account_reserve = false;
        $scope.contact = webutil.getContact($scope.userBlob.data.contacts,
          $scope.counterparty);
        if ($scope.contact) {
          $scope.counterparty_name = $scope.contact.name;
          $scope.counterparty_address = $scope.contact.address;
        } else {
          $scope.counterparty_name = '';
          $scope.counterparty_address = $scope.counterparty;
        }
      }, true);

      /**
       * N2. Confirmation page
       */
      $scope.grant = function () {
        // set variable to show throbber
        $scope.verifying = true;
        $scope.error_account_reserve = false;

        function confirmGrant() {
          $scope.$apply(function() {
            // hide throbber
            $scope.verifying = false;

            $scope.lineCurrencyObj = Currency.from_human($scope.currency);
            var matchedCurrency = $scope.lineCurrencyObj.has_interest() ? $scope.lineCurrencyObj.to_hex() : $scope.lineCurrencyObj.get_iso();
            var match = /^([a-zA-Z0-9]{3}|[A-Fa-f0-9]{40})\b/.exec(matchedCurrency);

            if (!match) {
              // Currency code not recognized, should have been caught by
              // form validator.
              console.error('Currency code:', match, 'is not recognized');
              return;
            }

            if ($scope.advanced_feature_switch === false || $scope.amount === '') {
              // $scope.amount = Number(ripple.Amount.consts.max_value);
              $scope.amount = Options.gateway_max_limit;
            }

            var amount = ripple.Amount.from_human('' + $scope.amount + ' ' + $scope.lineCurrencyObj.to_hex(), {reference_date: new Date(+new Date() + 5 * 60000)});

            amount.set_issuer($scope.counterparty_address);
            if (!amount.is_valid()) {
              // Invalid amount. Indicates a bug in one of the validators.
              return;
            }

            $scope.amount_feedback = amount;

            $scope.confirm_wait = true;
            $timeout(function () {
              $scope.confirm_wait = false;
            }, 1000, true);

            $scope.mode = 'confirm';
          });
        }

        confirmGrant();
      };

      /**
       * N3. Waiting for grant result page
       */
      $scope.grant_confirmed = function () {
        var amount = $scope.amount_feedback.to_json();
        var tx = $network.remote.transaction();
        // Add memo to tx
        tx.addMemo('client', 'rt' + $scope.version);


        var flags = [];
        // Set or clear Rippling flag
        if ($scope.allowrippling) {
          flags.push('ClearNoRipple');
        } else {
          flags.push('SetNoRipple');
        }
        // Set auth flag (this cannot be unset)
        if ($scope.tfSetfAuth) {
          flags.push('SetAuth');
        }
        if ($scope.tfSetFreeze) {
          flags.push('SetFreeze');
        } else {
          flags.push('ClearFreeze');
        }
        tx
          .rippleLineSet(id.account, amount)
          .setFlags(flags)
          .on('proposed', function(res) {
            $scope.$apply(function () {
              setEngineStatus(res, false);
              $scope.granted(tx.hash);

              // Remember currency and increase order
              for (var i = 0; i < $scope.currencies_all.length; i++) {
                if ($scope.currencies_all[i].value.toLowerCase() === $scope.amount_feedback.currency().get_iso().toLowerCase()) {
                  $scope.currencies_all[i].order++;
                  break;
                }
              }
            });
          })
          .on('success', function(res) {
            $scope.$apply(function() {
              setEngineStatus(res, true);
            });
          })
          .on('error', function(res) {
            setImmediate(function () {
              $scope.$apply(function() {
                $scope.mode = 'error';
                $scope.trust.loading = false;
                var notification = res.result === 'tejMaxFeeExceeded' ? 'max_fee' : 'error';
                $scope.load_notification(notification);
              });
            });
          })
        ;

        keychain.requestSecret(id.account, id.username, function(err, secret) {
          // XXX Error handling
          if (err) {
            return;
          }

          $scope.mode = 'granting';

          tx.secret(secret);


          // If online, submit tx to network, else display tx blob so it can be submitted later
          if ($scope.onlineMode) {
            tx.submit();
            if (tx.tx_json.LimitAmount.issuer == 'rrh7rf1gV2pXAoqA8oYbpHd8TKv5ZQeo67') {
              store.set('gbi_connected', true);
            }
            $scope.toggle_form();
          } else {
            tx.tx_json.Sequence = Number($scope.sequence);
            $scope.incrementSequence();
            tx.tx_json.Fee = Number($scope.fee);
            tx.complete();
            try {
              $scope.signedTransaction = tx.sign().serialize().to_hex();
              $scope.txJSON = JSON.stringify(tx.tx_json);
              $scope.hash = tx.hash('HASH_TX_ID', false, undefined);
              $scope.saveTransaction(tx);
            } catch (e) {
              console.log('Caught error');
              $scope.trust.loading = false;
              $scope.load_notification('error');
              return;
            }
            $scope.mode = 'offlineSending';
          }
        });
      };

      /**
       * N5. Granted page
       */
      $scope.granted = function (hash) {
        $scope.mode = 'granted';
        $network.remote.on('transaction', handleAccountEvent);

        function handleAccountEvent(e) {
          $scope.$apply(function () {
            if (e.transaction.hash === hash) {
              setEngineStatus(e, true);
              $network.remote.removeListener('transaction', handleAccountEvent);
            }
          });
        }

        $timeout(function() {
          $scope.mode = 'main';
        }, 10000);
      };

      function setEngineStatus(res, accepted) {
        $scope.engine_result = res.engine_result;
        $scope.engine_result_message = res.engine_result_message;

        switch (res.engine_result.slice(0, 3)) {
        case 'tes':
          $scope.tx_result = accepted ? 'cleared' : 'pending';
          break;
        case 'tem':
          $scope.tx_result = 'malformed';
          break;
        case 'ter':
          $scope.tx_result = 'failed';
          break;
        case 'tec':
          $scope.tx_result = 'failed';
          break;
        case 'tel':
          $scope.tx_result = 'local';
          break;
        case 'tep':
          console.warn('Unhandled engine status encountered!');
        }
      }

      $scope.$watch('userBlob.data.contacts', function (contacts) {
        $scope.counterparty_query = webutil.queryFromContacts(contacts);
      }, true);

      $scope.currency_query = webutil.queryFromOptionsIncludingKeys($scope.currencies_all);

      $scope.reset();

      var updateAccountLines = function() {
        var obj = {};

        _.each($scope.lines, function(line) {
          if (!obj[line.currency]) {
            obj[line.currency] = { components: [] };
          }

          obj[line.currency].components.push(line);
          if (line.account === 'rrh7rf1gV2pXAoqA8oYbpHd8TKv5ZQeo67') {
            store.set('gbi_connected', true);
          }
        });

        $scope.accountLines = obj;
        return;
      };

      $scope.$on('$balancesUpdate', function() {
        updateAccountLines();
      });

      updateAccountLines();


      $scope.saveAddress = function() {
        $scope.addressSaving = true;

        var contact = {
          name: $scope.saveAddressName,
          view: $scope.counterparty_address,
          address: $scope.counterparty_address
        };

        $scope.userBlob.unshift('/contacts', contact, function(err, data) {
          $scope.addressSaving = false;
          if (err) {
            console.log('Can\'t save the contact. ', err);
            return;
          }

          $scope.contact = data;
          $scope.addressSaved = true;
        });
      };
    }]);

  module.controller('AccountRowCtrl', ['$scope', 'rpBooks', 'rpNetwork', 'rpId', 'rpKeychain', '$timeout',
    function ($scope, books, $network, id, keychain, $timeout) {

      $scope.validation_pattern = /^0*(([0-9]*.?[0-9]*)|(.0*[1-9][0-9]*))$/;
      var AuthEnabled = 0x00040000;

      $scope.$watch('account', function() {
        $scope.disallowAuth = !($scope.account.Flags & AuthEnabled);
      }, true);
      $scope.cancel = function () {
        $scope.editing = false;
      };

      $scope.edit_account = function() {
        $scope.editing = true;


        $scope.trust = {};
        $scope.trust.limit = Number($scope.component.limit.to_json().value);
        $scope.trust.rippling = !$scope.component.no_ripple;
        $scope.trust.freeze = $scope.component.freeze;
        $scope.trust.auth = !!$scope.component.authorized;
        $scope.trust.limit_peer = Number($scope.component.limit_peer.to_json().value);
        $scope.trust.balance = String($scope.component.balance.to_json().value);
        $scope.trust.balanceAmount = $scope.component.balance;

        var currency = Currency.from_human($scope.component.currency);

        if (currency.to_human({full_name: $scope.currencies_all_keyed[currency.get_iso()]})) {
          $scope.trust.currency = currency.to_human({
            full_name: $scope.currencies_all_keyed[currency]
          });
        } else {
          $scope.trust.currency = currency.to_human({
            full_name: $scope.currencies_all_keyed[currency.get_iso()].name
          });
        }

        // $scope.trust.currency = currency.to_human({full_name:$scope.currencies_all_keyed[currency.get_iso()].name});
        $scope.trust.counterparty = $scope.component.account;

        $scope.load_orderbook();
      };

      $scope.delete_account = function() {
        $scope.trust.loading = true;
        $scope.load_notification('remove_trustline');

        var setSecretAndSubmit = function(tx) {
          keychain.requestSecret(id.account, id.username, function (err, secret) {
            if (err) {
              $scope.mode = 'error';
              console.log('Error on requestSecret: ', err);
              $scope.trust.loading = false;
              $scope.load_notification('error');
              return;
            }

            tx.secret(secret);

            // If online, submit tx to network to delete trustline
            // Otherwise display tx blob for user to copy
            if ($scope.onlineMode) {
              tx.submit(function(error, res) {
                if (error) {
                  $scope.mode = 'error';
                  $scope.trust.loading = false;
                  var notification = error.result === 'tejMaxFeeExceeded' ? 'max_fee' : 'error';
                  $scope.load_notification(notification);

                  return;
                }

                console.log('Transaction has been submitted with response:', res);
                $scope.trust.loading = false;
                $scope.load_notification('trustline_removed');
              });
            } else {
              tx.tx_json.Sequence = Number($scope.sequence);
              $scope.incrementSequence();
              tx.tx_json.Fee = Number($scope.fee);
              tx.complete();
              try {
                $scope.signedTransaction = tx.sign().serialize().to_hex();
                $scope.txJSON = JSON.stringify(tx.tx_json);
                $scope.hash = tx.hash('HASH_TX_ID', false, undefined);
                $scope.saveTransaction(tx);
              } catch (e) {
                console.log('Caught error');
                $scope.trust.loading = false;
                $scope.load_notification('error');
                return;
              }

              $scope.mode = 'offlineEdit';
              $scope.trust.loading = false;
              $scope.load_notification('success');
              $scope.editing = false;
            }
          });
        };

        var nullifyTrustLine = function(idAccount, lineCurrency, lineAccount) {
          var tx = $network.remote.transaction();

          // Add memo to tx
          tx.addMemo('client', 'rt' + $scope.version);

          tx.trustSet(idAccount, '0' + '/' + lineCurrency + '/' + lineAccount);
          var flags = ['ClearFreeze'];
          if ($scope.acctDefaultRippleFlag) {
            flags.push('ClearNoRipple');
          } else {
            flags.push('SetNoRipple');
          }
          tx.setFlags(flags);
          setSecretAndSubmit(tx);
        };

        var clearBalance = function(selfAddress, issuerAddress, curr, amountObject, callback) {

          // Decision tree: two paths
          // 1) There is a market -> send back balance to user as XRP
          // 2) There is no market -> send back balance to issuer

          var sendBalanceToSelf = function() {
            var tx = $network.remote.transaction();

            // Add memo to tx
            tx.addMemo('client', 'rt' + $scope.version);

            var payment = tx.payment(selfAddress, selfAddress, '100000000000');

            payment.setFlags('PartialPayment');
            payment.sendMax(amountObject.to_human() + '/' + curr + '/' + issuerAddress);

            return tx;
          };

          var sendBalanceToIssuer = function() {
            var tx = $network.remote.transaction();

            // Add memo to tx
            tx.addMemo('client', 'rt' + $scope.version);

            var amount = amountObject.clone();
            var newAmount = amount.set_issuer(issuerAddress);
            var payment = tx.payment(selfAddress, issuerAddress, newAmount);

            return tx;
          };

          var tx = ($scope.orderbookStatus === 'exists') ? sendBalanceToSelf() : sendBalanceToIssuer();

          setSecretAndSubmit(tx);

          tx.once('proposed', callback);
        };

        // $scope.counterparty inside the clearBalance callback function does not have counterparty in its scope, therefore, we need an immediate function to capture it.

        if ($scope.trust.balance !== '0') {
          (function (counterparty) {
            clearBalance(id.account, $scope.trust.counterparty, $scope.trust.currency, $scope.trust.balanceAmount, function() {
              nullifyTrustLine(id.account, $scope.trust.currency, counterparty);
            });
          })($scope.trust.counterparty);
          if ($scope.trust.counterparty === 'rrh7rf1gV2pXAoqA8oYbpHd8TKv5ZQeo67') {
            store.set('gbi_connected', false);
          }
        } else {
          nullifyTrustLine(id.account, $scope.trust.currency, $scope.trust.counterparty);
          if ($scope.trust.counterparty === 'rrh7rf1gV2pXAoqA8oYbpHd8TKv5ZQeo67') {
            store.set('gbi_connected', false);
          }
        }

      };

      $scope.load_orderbook = function() {
        $scope.orderbookStatus = false;

        if ($scope.book) {
          $scope.book.unsubscribe();
        }

        $scope.book = books.get({
          currency: $scope.trust.currency,
          issuer: $scope.trust.counterparty
        }, {

          currency: 'XRP',
          issuer: undefined
        });

        $scope.$watchCollection('book', function () {
          if (!$scope.book.updated) {
            return;
          }

          if ($scope.book.asks.length !== 0 && $scope.book.bids.length !== 0) {
            $scope.orderbookStatus = 'exists';
          } else {
            $scope.orderbookStatus = 'not';
          }
        });
      };

      $scope.save_account = function () {
        $scope.trust.loading = true;

        $scope.load_notification('loading');

        var amount = ripple.Amount.from_human(
          $scope.trust.limit + ' ' + $scope.component.currency,
          {reference_date: new Date(+new Date() + 5*60000)}
        );

        amount.set_issuer($scope.component.account);

        if (!amount.is_valid()) {
          // Invalid amount. Indicates a bug in one of the validators.
          console.log('Invalid amount');
          return;
        }

        var tx = $network.remote.transaction();

        // Add memo to tx
        tx.addMemo('client', 'rt' + $scope.version);
        // Flags
        var flags = [];
        // Set or clear Rippling flag
        if ($scope.trust.rippling) {
          flags.push('ClearNoRipple');
        } else {
          flags.push('SetNoRipple');
        }
        if ($scope.trust.freeze) {
          flags.push('SetFreeze');
        } else {
          flags.push('ClearFreeze');
        }
        // Set auth flag (this cannot be unset)
        if ($scope.trust.auth) {
          flags.push('SetAuth');
        }

        tx
          .rippleLineSet(id.account, amount)
          .setFlags(flags)
          .on('success', function(res) {
            $scope.$apply(function () {
              setEngineStatus(res, true);
              $scope.trust.loading = false
              $scope.load_notification('success');
              $scope.editing = false;
            });
          })
          .on('error', function(res) {
            setImmediate(function() {
              $scope.$apply(function() {
                $scope.mode = 'error';

                var notification = res.result === 'tejMaxFeeExceeded' ? 'max_fee' : 'error';
                $scope.load_notification(notification);

                $scope.trust.loading = false;
                $scope.editing = false;
              });
            });
          });

        function setEngineStatus(res, accepted) {
          $scope.engine_result = res.engine_result;
          $scope.engine_result_message = res.engine_result_message;

          switch (res.engine_result.slice(0, 3)) {
          case 'tes':
            $scope.tx_result = accepted ? 'cleared' : 'pending';
            break;
          case 'tem':
            $scope.tx_result = 'malformed';
            break;
          case 'ter':
            $scope.tx_result = 'failed';
            break;
          case 'tec':
            $scope.tx_result = 'failed';
            break;
          case 'tel':
            $scope.tx_result = 'local';
            break;
          case 'tep':
            console.warn('Unhandled engine status encountered!');
          }
        }

        keychain.requestSecret(id.account, id.username, function (err, secret) {
          // XXX Error handling
          if (err) {
            $scope.trust.loading = false;
            $scope.load_notification('error');

            return;
          }

          $scope.mode = 'granting';
          tx.secret(secret);
          if ($scope.onlineMode) {
            tx.submit();
          } else {
            tx.tx_json.Sequence = Number($scope.sequence);
            $scope.incrementSequence();
            tx.tx_json.Fee = Number($scope.fee);
            tx.complete();
            try {
              $scope.signedTransaction = tx.sign().serialize().to_hex();
              $scope.txJSON = JSON.stringify(tx.tx_json);
              $scope.hash = tx.hash('HASH_TX_ID', false, undefined);
              $scope.saveTransaction(tx);
            } catch (e) {
              $scope.trust.loading = false;
              $scope.load_notification('error');
              return;
            }

            $scope.mode = 'offlineEdit';
            $scope.trust.loading = false;
            $scope.load_notification('success');
            $scope.editing = false;
          }
        });
      };

      $scope.close_sign_form = function () {
        $scope.mode = 'main';
      };
    }]);
};


module.exports = TrustTab;
