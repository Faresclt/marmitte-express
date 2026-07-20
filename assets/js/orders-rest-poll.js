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

  // Rules v4 : /orders exige request.auth != null même en lecture. Le poll
  // REST doit donc joindre le token Firebase Auth (posé par firebase-sync.js
  // via window.__fbGetIdToken). Sans token (SDK bloqué → auth impossible),
  // on skip proprement au lieu de spammer des 403.
  var _noTokenWarned = false;
  async function _authHeaders() {
    try {
      if (typeof window.__fbGetIdToken === 'function') {
        var tok = await window.__fbGetIdToken();
        if (tok) return { Authorization: 'Bearer ' + tok };
      }
    } catch (e) {}
    return null;
  }

  // Marque un order comme reçu via REST PATCH (requires auth, peut échouer
  // silencieusement). Si ça échoue, l'order reste pending et sera réimporté,
  // mais c'est idempotent côté tableData donc OK.
  async function markOrderReceived(orderId) {
    var auth = await _authHeaders();
    if (!auth) return;
    var url = BASE + '/orders/' + orderId + '?updateMask.fieldPaths=status';
    var headers = { 'Content-Type': 'application/json' };
    headers.Authorization = auth.Authorization;
    return fetch(url, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ fields: { status: { stringValue: 'received' } } })
    }).catch(function(e) { /* silent fail */ });
  }

  async function pollOrdersViaREST() {
    try {
      var auth = await _authHeaders();
      if (!auth) {
        if (!_noTokenWarned) {
          _noTokenWarned = true;
          console.warn('[REST poll] pas de token auth (SDK indispo ?) — poll orders désactivé, rules v4 exigent auth');
        }
        return;
      }
      var res = await fetch(BASE + '/orders?pageSize=200', {
        mode: 'cors',
        credentials: 'omit',
        headers: auth
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

  // Sync branding (logo, accent, nom) depuis Firebase config/menu via REST
  // Garantit que tous les devices voient le même branding même si le
  // Firebase SDK est bloqué.
  async function pullBrandingViaREST() {
    try {
      var res = await fetch(BASE + '/config/menu', { mode: 'cors', credentials: 'omit' });
      if (!res.ok) return;
      var doc = await res.json();
      var fields = doc.fields || {};
      var branding = fields.branding ? parseFsValue(fields.branding) : null;
      if (!branding) return;
      window.__fbBranding = branding;

      // Met à jour localStorage brand_* SEULEMENT si Firebase a une valeur.
      // Ne JAMAIS supprimer le cache local si Firebase est vide :
      // sinon on perd les paramètres locaux que le user a configurés
      // mais qui ne sont pas (encore) montés dans Firebase.
      try {
        if (branding.logoUrl) localStorage.setItem('brand_logoUrl', JSON.stringify(branding.logoUrl));
        if (branding.name)    localStorage.setItem('brand_name',    JSON.stringify(branding.name));
        if (branding.accent)  localStorage.setItem('brand_accent',  JSON.stringify(branding.accent));
      } catch (e) {}

      // Met à jour l'objet `branding` JS si défini (caisse classic script)
      // Seuls les champs présents dans Firebase écrasent le local
      if (typeof window.branding !== 'undefined' && window.branding) {
        if (branding.name)    window.branding.name = branding.name;
        if (branding.tagline) window.branding.tagline = branding.tagline;
        if (branding.emoji)   window.branding.emoji = branding.emoji;
        if (branding.accent)  window.branding.accent = branding.accent;
        if (branding.logoUrl) window.branding.logoUrl = branding.logoUrl;
        if (typeof window.applyBranding === 'function') {
          try { window.applyBranding(); } catch(e){}
        }
      }
      // Met à jour l'accent CSS au cas où
      if (branding.accent) {
        document.documentElement.style.setProperty('--accent', branding.accent);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', branding.accent);
      }
    } catch (e) {
      console.warn('[branding pull] error:', e && e.message || e);
    }
  }

  window.pullBrandingViaREST = pullBrandingViaREST;
  // Pull branding au boot puis toutes les 30s (peu fréquent, change rarement)
  setTimeout(pullBrandingViaREST, 1000);
  setInterval(pullBrandingViaREST, 30000);

  // Auto-récupération du logo : si Firebase config/menu n'a pas de logoUrl
  // mais que le fichier existe dans Firebase Storage (branding/logo.png),
  // on le restaure automatiquement. Couvre le cas où le user a upload
  // un logo dans le passé mais que l'URL a été perdue dans config/menu.
  async function autoRestoreLogo() {
    try {
      // Si Firebase a déjà un logoUrl OU on n'a pas encore les data, skip
      if (window.__fbBranding && window.__fbBranding.logoUrl) return;
      if (!window.__fbBranding) return;
      // Test si Storage a un logo
      var storageUrl = 'https://firebasestorage.googleapis.com/v0/b/la-marmitte-express.firebasestorage.app/o/branding%2Flogo.png?alt=media';
      var head = await fetch(storageUrl, { method: 'HEAD', mode: 'cors' });
      if (!head.ok) return;
      // Storage a un logo mais config/menu pas. On le restaure si le SDK est dispo.
      if (window.FB && window.FB.setMerge) {
        console.log('[auto-restore] logo trouvé dans Storage, restoration → config/menu');
        var newBranding = Object.assign({}, window.__fbBranding || {}, { logoUrl: storageUrl });
        await window.FB.setMerge('config', 'menu', { branding: newBranding });
        // Update local
        try { localStorage.setItem('brand_logoUrl', JSON.stringify(storageUrl)); } catch(e){}
        if (typeof window.branding !== 'undefined') {
          window.branding.logoUrl = storageUrl;
          if (typeof window.applyBranding === 'function') window.applyBranding();
        }
        console.log('[auto-restore] logo restauré dans Firebase config/menu');
      } else {
        // SDK pas dispo, applique localement au moins
        try { localStorage.setItem('brand_logoUrl', JSON.stringify(storageUrl)); } catch(e){}
        if (typeof window.branding !== 'undefined') {
          window.branding.logoUrl = storageUrl;
          if (typeof window.applyBranding === 'function') window.applyBranding();
        }
        console.log('[auto-restore] logo appliqué localement (SDK indispo, pas pushé sur Firebase)');
      }
    } catch (e) {
      console.warn('[auto-restore] error:', e && e.message || e);
    }
  }
  window.autoRestoreLogo = autoRestoreLogo;
  setTimeout(autoRestoreLogo, 3000); // après que pullBrandingViaREST ait remplit __fbBranding

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
