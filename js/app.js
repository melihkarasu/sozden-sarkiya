function safeCopyToClipboard(text, msg) {
  if (window.copyToClipboard) {
    window.copyToClipboard(text, msg);
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      if (window.showToast) window.showToast('✓ ' + (msg || 'Panoya kopyalandı!'));
    }).catch(() => fallbackExecCopy(text, msg));
  } else {
    fallbackExecCopy(text, msg);
  }
}
function fallbackExecCopy(text, msg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (window.showToast) window.showToast('✓ ' + (msg || 'Panoya kopyalandı!'));
  } catch(e) {
    if (window.showToast) window.showToast('Kopyalama başarısız');
  }
  document.body.removeChild(ta);
}

let currentResults = [];
        let currentModalSong = null;
        let playingAudioUrl = null;

        // 1. Arama Fonksiyonu
        async function searchMusic() {
          const query = document.getElementById('input-lyrics-search').value.trim();
          if (!query) return;

          showLoading(true);

          try {
            // 1. Adım: LRCLIB üzerinden şarkı sözü arama
            const lrcRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
              headers: { 'User-Agent': 'VibeCodedApps/1.0' }
            });
            const lrcData = await lrcRes.json();

            // 2. Adım: iTunes üzerinden ses önizlemesi ve albüm kapakları arama
            const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`);
            const itunesData = await itunesRes.json();

            const itunesMap = {};
            if (itunesData.results) {
              itunesData.results.forEach(it => {
                const key = (it.trackName + ' ' + it.artistName).toLowerCase();
                itunesMap[key] = it;
              });
            }

            // Birleştir ve normalleştir
            const combined = [];
            const seen = new Set();

            if (Array.isArray(lrcData)) {
              lrcData.forEach(item => {
                const tName = item.trackName || item.name;
                const aName = item.artistName;
                const pairKey = (tName + ' ' + aName).toLowerCase();

                if (!seen.has(pairKey)) {
                  seen.add(pairKey);

                  // iTunes eşleşmesi ara
                  let matchedItunes = itunesMap[pairKey];
                  if (!matchedItunes && itunesData.results) {
                    matchedItunes = itunesData.results.find(it => 
                      it.trackName.toLowerCase().includes(tName.toLowerCase()) || 
                      tName.toLowerCase().includes(it.trackName.toLowerCase())
                    );
                  }

                  combined.push({
                    id: item.id,
                    trackName: tName,
                    artistName: aName,
                    albumName: item.albumName || (matchedItunes ? matchedItunes.collectionName : ''),
                    duration: item.duration,
                    plainLyrics: item.plainLyrics || 'Şarkı sözü bulunamadı.',
                    cover: matchedItunes ? matchedItunes.artworkUrl100.replace('100x100bb', '400x400bb') : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
                    previewUrl: matchedItunes ? matchedItunes.previewUrl : null,
                    genre: matchedItunes ? matchedItunes.primaryGenreName : 'Müzik',
                    year: matchedItunes && matchedItunes.releaseDate ? matchedItunes.releaseDate.substring(0, 4) : ''
                  });
                }
              });
            }

            // Eğer LRCLIB az sonuç verdiyse iTunes sonuçlarını da ekle
            if (itunesData.results) {
              itunesData.results.forEach(it => {
                const pairKey = (it.trackName + ' ' + it.artistName).toLowerCase();
                if (!seen.has(pairKey) && combined.length < 20) {
                  seen.add(pairKey);
                  combined.push({
                    id: 'itunes_' + it.trackId,
                    trackName: it.trackName,
                    artistName: it.artistName,
                    albumName: it.collectionName,
                    duration: Math.round(it.trackTimeMillis / 1000),
                    plainLyrics: null,
                    cover: it.artworkUrl100.replace('100x100bb', '400x400bb'),
                    previewUrl: it.previewUrl,
                    genre: it.primaryGenreName,
                    year: it.releaseDate ? it.releaseDate.substring(0, 4) : ''
                  });
                }
              });
            }

            currentResults = combined;
            renderResults(combined, query);
          } catch (err) {
            console.error(err);
            showLoading(false);
          }
        }

        function quickSearch(term) {
          document.getElementById('input-lyrics-search').value = term;
          searchMusic();
        }

        function showLoading(show) {
          document.getElementById('loading-spinner').className = show ? 'py-16 text-center text-mistral-slate text-sm flex flex-col items-center gap-3' : 'hidden';
          if (show) {
            document.getElementById('music-results-grid').innerHTML = '';
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('results-count').innerText = 'Aranıyor...';
          }
        }

        // 2. Kartları Ekrana Çiz
        function renderResults(list, query) {
          showLoading(false);
          const grid = document.getElementById('music-results-grid');
          const countEl = document.getElementById('results-count');
          const emptyEl = document.getElementById('empty-state');

          if (!list || list.length === 0) {
            grid.innerHTML = '';
            countEl.innerText = '0 şarkı bulundu';
            emptyEl.classList.remove('hidden');
            return;
          }

          emptyEl.classList.add('hidden');
          countEl.innerText = `${list.length} eşleşen şarkı listelendi`;

          grid.innerHTML = list.map((item, idx) => {
            const hasPreview = !!item.previewUrl;
            return `
              <div class="song-card p-4 rounded-2xl bg-white border border-mistral-hairline hover:border-pink-500/50 transition-all duration-300 shadow-lg flex flex-col justify-between group">
                <div>
                  <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-white shadow">
                    <img src="${item.cover}" alt="${item.trackName}" class="w-full h-full object-cover">
                    
                    ${hasPreview ? `
                      <div class="play-overlay absolute inset-0 bg-black/40 opacity-0 transition-opacity flex items-center justify-center">
                        <button onclick="playAudioPreview('${item.previewUrl}', '${item.trackName.replace(/'/g, "\\\\'")}', '${item.artistName.replace(/'/g, "\\\\'")}')" class="w-12 h-12 rounded-full bg-pink-500 hover:bg-pink-400 text-white flex items-center justify-center shadow-lg transition transform hover:scale-110">
                          ▶
                        </button>
                      </div>
                    ` : ''}
                  </div>

                  <h3 class="font-bold text-sm text-mistral-ink group-hover:text-pink-400 transition truncate">${item.trackName}</h3>
                  <p class="text-xs text-pink-400/90 font-medium truncate mt-0.5">${item.artistName}</p>
                  <p class="text-[11px] text-mistral-slate truncate mt-0.5">${item.albumName || 'Single'}</p>
                </div>

                <div class="pt-3 border-t border-mistral-hairline flex items-center justify-between mt-3">
                  <button onclick="openLyricsModal(${idx})" class="text-xs text-pink-400 hover:text-pink-300 font-semibold transition">
                    Sözleri Oku &rarr;
                  </button>
                  <button onclick="quickSaveSong(${idx})" class="text-xs text-mistral-slate hover:text-amber-400 transition p-1" title="Çalma Listeme Kaydet">
                    🔖
                  </button>
                </div>
              </div>
            `;
          }).join('');
        }

        // 3. Ses Önizleme Çalar (30s Audio Player)
        function playAudioPreview(url, trackName, artistName) {
          const audio = document.getElementById('global-audio');
          const bar = document.getElementById('global-player-bar');
          const btn = document.getElementById('btn-global-play');
          const tName = document.getElementById('global-track-name');
          const aName = document.getElementById('global-artist-name');

          if (playingAudioUrl === url && !audio.paused) {
            audio.pause();
            btn.innerText = '▶';
            return;
          }

          audio.src = url;
          audio.play();
          playingAudioUrl = url;

          bar.classList.remove('hidden');
          bar.classList.add('flex');
          btn.innerText = '⏸';
          tName.innerText = trackName;
          aName.innerText = artistName;

          showToast(`🎵 Çalıyor: ${trackName} - ${artistName}`);
        }

        function toggleGlobalAudio() {
          const audio = document.getElementById('global-audio');
          const btn = document.getElementById('btn-global-play');
          if (audio.paused) {
            audio.play();
            btn.innerText = '⏸';
          } else {
            audio.pause();
            btn.innerText = '▶';
          }
        }

        function onAudioEnded() {
          const btn = document.getElementById('btn-global-play');
          if (btn) btn.innerText = '▶';
          playingAudioUrl = null;
        }

        // 4. Şarkı Sözü Detay Modalı
        async function openLyricsModal(idx) {
          const song = currentResults[idx];
          if (!song) return;

          currentModalSong = song;

          document.getElementById('modal-cover-img').src = song.cover;
          document.getElementById('modal-song-title').innerText = song.trackName;
          document.getElementById('modal-artist-title').innerText = song.artistName;
          document.getElementById('modal-album-title').innerText = song.albumName ? `Albüm: ${song.albumName}` : '';
          document.getElementById('modal-genre-badge').innerText = song.genre || 'Müzik';
          document.getElementById('modal-year-badge').innerText = song.year || '';

          // Ses önizleme butonu
          const prevBox = document.getElementById('modal-preview-btn-container');
          if (song.previewUrl) {
            prevBox.innerHTML = `
              <button onclick="playAudioPreview('${song.previewUrl}', '${song.trackName.replace(/'/g, "\\\\'")}', '${song.artistName.replace(/'/g, "\\\\'")}')" class="px-3 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow">
                <span>▶</span> 30s Dinle
              </button>
            `;
          } else {
            prevBox.innerHTML = '';
          }

          // Sözleri göster veya çek
          const lyricsBody = document.getElementById('modal-lyrics-body');
          if (song.plainLyrics) {
            lyricsBody.innerText = song.plainLyrics;
          } else {
            lyricsBody.innerText = 'Sözler yükleniyor...';
            try {
              const res = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(song.trackName)}&artist_name=${encodeURIComponent(song.artistName)}`, {
                headers: { 'User-Agent': 'VibeCodedApps/1.0' }
              });
              const lrc = await res.json();
              song.plainLyrics = lrc.plainLyrics || 'Bu parça için şarkı sözü bulunamadı.';
              lyricsBody.innerText = song.plainLyrics;
            } catch(e) {
              lyricsBody.innerText = 'Şarkı sözleri yüklenemedi.';
            }
          }

          updateModalFavButtonState();
          document.getElementById('lyrics-modal').classList.remove('hidden');
        }

        function closeModal() {
          document.getElementById('lyrics-modal').classList.add('hidden');
          currentModalSong = null;
        }

        // 5. Kayıtlı Çalma Listem (Playlist & LocalStorage)
        const PLAYLIST_STORAGE_KEY = 'vibe_s…ylist';

        function getSavedSongs() {
          try {
            return JSON.parse(localStorage.getItem(PLAYLIST_STORAGE_KEY) || '[]');
          } catch(e) {
            return [];
          }
        }

        function toggleModalFavorite() {
          if (!currentModalSong) return;
          let list = getSavedSongs();
          const exists = list.some(s => s.trackName === currentModalSong.trackName && s.artistName === currentModalSong.artistName);

          if (exists) {
            list = list.filter(s => !(s.trackName === currentModalSong.trackName && s.artistName === currentModalSong.artistName));
            showToast('Çalma listesinden çıkarıldı.');
          } else {
            list.unshift({
              trackName: currentModalSong.trackName,
              artistName: currentModalSong.artistName,
              albumName: currentModalSong.albumName,
              cover: currentModalSong.cover,
              previewUrl: currentModalSong.previewUrl,
              plainLyrics: currentModalSong.plainLyrics,
              date: new Date().toLocaleDateString('tr-TR')
            });
            showToast('✓ Çalma listenize eklendi!');
          }

          localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(list));
          updateModalFavButtonState();
          renderSavedSongs();
        }

        function quickSaveSong(idx) {
          const song = currentResults[idx];
          if (!song) return;

          let list = getSavedSongs();
          if (list.some(s => s.trackName === song.trackName && s.artistName === song.artistName)) {
            showToast('Bu parça zaten listenizde var.');
            return;
          }

          list.unshift({
            trackName: song.trackName,
            artistName: song.artistName,
            albumName: song.albumName,
            cover: song.cover,
            previewUrl: song.previewUrl,
            plainLyrics: song.plainLyrics,
            date: new Date().toLocaleDateString('tr-TR')
          });

          localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(list));
          showToast(`✓ "${song.trackName}" çalma listenize eklendi!`);
          renderSavedSongs();
        }

        function updateModalFavButtonState() {
          if (!currentModalSong) return;
          const list = getSavedSongs();
          const isSaved = list.some(s => s.trackName === currentModalSong.trackName && s.artistName === currentModalSong.artistName);
          const icon = document.getElementById('modal-fav-icon');
          const text = document.getElementById('modal-fav-text');

          if (isSaved) {
            icon.innerText = '✓';
            text.innerText = 'Çalma Listenizde';
          } else {
            icon.innerText = '🔖';
            text.innerText = 'Listeme Ekle';
          }
        }

        function renderSavedSongs() {
          const grid = document.getElementById('saved-songs-grid');
          const empty = document.getElementById('saved-songs-empty');
          const list = getSavedSongs();

          if (list.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
          }

          empty.classList.add('hidden');
          grid.innerHTML = list.map((song, idx) => `
            <div class="p-3 rounded-2xl bg-white border border-mistral-hairline hover:border-pink-500/40 transition flex items-center gap-3">
              <div class="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white">
                <img src="${song.cover}" class="w-full h-full object-cover">
                ${song.previewUrl ? `
                  <button onclick="playAudioPreview('${song.previewUrl}', '${song.trackName.replace(/'/g, "\\\\'")}', '${song.artistName.replace(/'/g, "\\\\'")}')" class="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center text-white text-xs transition">
                    ▶
                  </button>
                ` : ''}
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="font-bold text-xs text-mistral-ink truncate">${song.trackName}</h4>
                <p class="text-[10px] text-pink-400 truncate">${song.artistName}</p>
                <span class="text-[9px] text-mistral-stone">${song.date}</span>
              </div>
              <button onclick="removeSavedSong(${idx})" class="text-xs text-mistral-stone hover:text-rose-400 p-1 transition" title="Kaldır">
                ✕
              </button>
            </div>
          `).join('');
        }

        function removeSavedSong(idx) {
          let list = getSavedSongs();
          list.splice(idx, 1);
          localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(list));
          renderSavedSongs();
        }

        function clearAllSavedSongs() {
          if (!confirm('Tüm çalma listenizi silmek istediğinize emin misiniz?')) return;
          localStorage.removeItem(PLAYLIST_STORAGE_KEY);
          renderSavedSongs();
        }

        function copyLyrics() {
          if (!currentModalSong || !currentModalSong.plainLyrics) return;
          safeCopyToClipboard(currentModalSong.plainLyrics, 'Şarkı sözleri panoya kopyalandı!');
        }

        function showToast(msg) {
          const toast = document.getElementById('music-toast');
          toast.innerText = msg;
          toast.classList.remove('hidden');
          setTimeout(() => toast.classList.add('hidden'), 3500);
        }

        // Başlangıç
        document.addEventListener('DOMContentLoaded', () => {
          searchMusic();
          renderSavedSongs();
        });
