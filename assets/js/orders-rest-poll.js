/* ============================================================
   orders-rest-poll.js — Polling Firestore REST API SANS Firebase SDK

   Garantit que les commandes Firebase sont récupérées MÊME SI :
   - Firebase JS SDK est bloqué (addon, firewall, gstatic.com unreachable)
   - Le module Firebase a échoué à charger
   - L'auth Firebase ne marche pas
   - Le WebSocket onSnapshot est mort

   Les règles Firestore permettent `allow read: if true` sur /orders
   donc aucune auth requise pour la lecture publique.

   Expose :
     window.fbOrders               → objet {orderId: {tableId, status, items, ...}}
     window.__lastRestPoll         → timestamp dernière sync REST réussie
     window.__lastRestPollError    → message d'erreur dernière sync REST
     window.pollOrdersViaREST()    → trigger manuel
     window.diagOrders()           → diagnostic complet console
   ============================================================ */
(function() {
  'use strict';

  var PROJECT_ID = 'la-marmitte-express';
  var BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

  function parseFsValue(v) {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return parseInt(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.nullValue !== undefined) return null;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.arrayValue) return (v.arrayValue.values || []).map(parseFsValue);
    if (v.mapValue) {
      var out = {};
      var fields = v.mapValue.fields || {};
      Object.keys(fields).forEach(function(k) { out[k] = parseFsValue(fields[k]); });
      return out;
    }
    return null;
  }

  function parseDoc(doc) {
    var id = doc.name.split('/').pop();
    var fields = {};
    Object.keys(doc.fields || {}).forEach(function(k) {
      fields[k] = parseFsValue(doc.fields[k]);
    });
    fields._id = id;
    return fields;
  }

  // Marque un order comme reçu via REST PATCH (requires auth, peut échouer
  // silencieusement). Si ça échoue, l'order reste pending et sera réimporté,
  // mais c'est idempotent côté tableData donc OK.
  function markOrderReceived(orderId) {
    var url = BASE + '/orders/' + orderId + '?updateMask.fieldPaths=status';
    return fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { status: { stringValue: 'received' } } })
    }).catch(function(e) { /* silent fail */ });
  }

  async function pollOrdersViaREST() {
    try {
      var res = await fetch(BASE + '/orders?pageSize=200', {
        mode: 'cors',
        credentials: 'omit'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var json = await res.json();
      var data = {};
      (json.documents || []).forEach(function(doc) {
        var d = parseDoc(doc);
        data[d._id] = d;
      });
      // Merge avec les orders existants (ne pas écraser si SDK a aussi récup)
      var current = window.fbOrders || {};
      Object.keys(data).forEach(function(k) { current[k] = data[k]; });
      window.fbOrders = current;
      window.__lastRestPoll = Date.now();
      window.__lastRestPollError = null;
      if (!window.__lastOrdersPoll) window.__lastOrdersPoll = Date.now();

      // Traiter les pending : importer dans tableData + marquer received
      var pending = Object.keys(data).filter(function(k) { return data[k].status === 'pending'; });
      pending.forEach(function(k) {
        var order = data[k];
        if (!order.tableId || !order.items) return;
        if (typeof window.importOrderToTable === 'function') {
          try { window.importOrderToTable(order); } catch (e) { console.warn('[REST] import error', e); }
        }
        markOrderReceived(order._id);
      });

      // Force render salle pour activer le fallback tableStatus
      if (typeof window.renderSalle === 'function') {
        try { window.renderSalle(); } catch (e) {}
      }
    } catch (e) {
      console.warn('[REST poll] error:', e && e.message || e);
      window.__lastRestPollError = e && e.message || String(e);
    }
  }

  window.pollOrdersViaREST = pollOrdersViaREST;

  // Démarre le polling à 5s après chargement (laisse le temps au SDK d'essayer en premier)
  setTimeout(pollOrdersViaREST, 1500);
  setInterval(pollOrdersViaREST, 5000);

  // ── Diagnostic console ──
  window.diagOrders = function() {
    var orders = window.fbOrders || {};
    var values = Object.values(orders);
    var pending = values.filter(function(o) { return o && o.status === 'pending'; });
    var received = values.filter(function(o) { return o && o.status === 'received'; });
    var info = {
      'Firebase SDK ready': !!(window.FB && window.FB.getOnce),
      'Orders en mémoire': values.length,
      'Orders pending': pending.length,
      'Orders received': received.length,
      'Dernier poll SDK': window.__lastOrdersPoll
        ? Math.round((Date.now() - window.__lastOrdersPoll) / 1000) + 's ago'
        : 'JAMAIS',
      'Dernier poll REST': window.__lastRestPoll
        ? Math.round((Date.now() - window.__lastRestPoll) / 1000) + 's ago'
        : 'JAMAIS',
      'Erreur SDK': window.__lastOrdersPollError || 'aucune',
      'Erreur REST': window.__lastRestPollError || 'aucune',
      'Tables dans le plan': (window.salleElements || []).length,
      'Tables avec data': Object.keys(window.tableData || {}).join(', ') || '(aucune)',
      'Pending tables': [...new Set(pending.map(function(o) { return o.tableId; }))].join(', ') || '(aucune)'
    };
    console.log('═══ DIAG ORDERS ═══');
    console.table(info);
    if (pending.length) {
      console.log('═══ DÉTAIL PENDING ═══');
      console.table(pending.map(function(o) {
        return {
          id: o._id,
          tableId: o.tableId,
          items: (o.items || []).map(function(i) { return i.qty + 'x ' + i.name; }).join(', '),
          status: o.status
        };
      }));
    }
    return info;
  };

  console.log('[orders-rest-poll.js] loaded — pollOrdersViaREST() & diagOrders() disponibles');
})();
