// sw.js - Service Worker para Holoxorn AI PWA
// Permite funcionamento offline e instalação como aplicativo

const CACHE_NAME = 'holoxorn-cache-v1';
const OFFLINE_URL = '/offline.html';

// Arquivos essenciais para cache (substitua pelos seus arquivos reais)
const urlsToCache = [
  '/',
  '/index.html',
  '/About Holoxorn.html',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://unpkg.com/i18next@21.10.0/dist/umd/i18next.min.js',
  'https://unpkg.com/i18next-browser-languagedetector@7.0.0/dist/umd/i18nextBrowserLanguageDetector.min.js'
];

// Instalação do Service Worker - cache dos arquivos
self.addEventListener('install', event => {
  console.log('[Holoxorn] Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Holoxorn] Cache aberto, adicionando arquivos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação - limpa caches antigos
self.addEventListener('activate', event => {
  console.log('[Holoxorn] Service Worker ativado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Holoxorn] Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia: Cache First, depois rede (para assets estáticos)
// Para a API, usamos Network First
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // Se for uma API request, usa Network First (tenta rede primeiro)
  if (requestUrl.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Para outros recursos (HTML, CSS, JS, imagens) - Cache First
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache
        }
        return fetch(event.request).then(response => {
          // Verifica se é uma resposta válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
      .catch(() => {
        // Se falhou tudo e é navegação, mostra página offline
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Conteúdo não disponível offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      })
  );
});

// Sincronização em segundo plano (para quando voltar online)
self.addEventListener('sync', event => {
  console.log('[Holoxorn] Sync event:', event.tag);
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Holoxorn AI tem novidades para você!',
    icon: '/assets/images/icon-192.png',
    badge: '/assets/images/badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('🤖 Holoxorn AI', options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Função para sincronizar mensagens pendentes
async function syncMessages() {
  try {
    const cache = await caches.open('holoxorn-messages');
    const messages = await cache.keys();
    
    for (const request of messages) {
      const response = await fetch(request);
      if (response.ok) {
        await cache.delete(request);
        console.log('[Holoxorn] Mensagem sincronizada:', request.url);
      }
    }
  } catch (error) {
    console.error('[Holoxorn] Erro na sincronização:', error);
  }
}

// Atualização de versão - notifica o usuário
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
