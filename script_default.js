/* Menu Mobile */
document.addEventListener('DOMContentLoaded', function() {
    const burger = document.querySelector('.asn-burger');
    const menu = document.querySelector('.asn-mobile-menu');
    const backdrop = document.querySelector('.asn-menu-backdrop');
    const navLinks = document.querySelectorAll('.asn-menu-nav a');

    function updateLogo() {
        const logoDesktop = document.querySelector('.asn-logo-desktop');
        const logoMobile = document.querySelector('.asn-logo-mobile');
        if (window.innerWidth >= 1024) {
            logoDesktop.style.display = 'block';
            logoMobile.style.display = 'none';
        } else {
            logoDesktop.style.display = 'none';
            logoMobile.style.display = 'block';
        }
    }

    if (burger && menu) {
        burger.addEventListener('click', function() {
            menu.classList.toggle('asn-active');
        });
    }

    if (backdrop && menu) {
        backdrop.addEventListener('click', function() {
            menu.classList.remove('asn-active');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            menu.classList.remove('asn-active');
        });
    });

    updateLogo();
    window.addEventListener('resize', updateLogo);
});

$(document).ready(function(){
    function load_data(query){
        $.ajax({
            url: "/template-php/defaut/fetch.php",
            method: "POST",
            data: { query: query },
            success: function(data){
                $('#asn-result-desktop').html(data);
                $('#asn-result-mobile').html(data);
            }
        });
    }

    $('input[name="search_text"]').on('keyup input search', function(){
        var search = $(this).val();
        if (search !== ''){
            load_data(search);
        } else {
            $('#asn-result-desktop').empty();
            $('#asn-result-mobile').empty();
        }
    });

    $('input[name="search_text"]').on('focus', function(){
        var search = $(this).val();
        if (search !== ''){
            load_data(search);
        }
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('input[name="search_text"], #asn-result-desktop, #asn-result-mobile').length) {
            $('#asn-result-desktop').empty();
            $('#asn-result-mobile').empty();
        }
    });

    let isDragging = false;
    let startX, scrollLeft;
    let activeDiv = null;

    $('.grabScroll').on('mousedown', function(e) {
        isDragging = true;
        activeDiv = $(this);
        activeDiv.addClass('dragging');
        startX = e.pageX - activeDiv.offset().left;
        scrollLeft = activeDiv.scrollLeft();
    });

    $(document).on('mousemove', function(e) {
        if (!isDragging || !activeDiv) return;
        e.preventDefault();
        const x = e.pageX - activeDiv.offset().left;
        const walk = (x - startX) * 2;
        activeDiv.scrollLeft(scrollLeft - walk);
    });

    $(document).on('mouseup', function() {
        isDragging = false;
        if (activeDiv) {
            activeDiv.removeClass('dragging');
            activeDiv = null;
        }
    });
});

$('body').on('contextmenu', 'img', function(e){return false;});

function decalRight(idContainer){ document.getElementById(idContainer).scrollLeft += 1000; }
function decalLeft(idContainer){ document.getElementById(idContainer).scrollLeft -= 1000; }

function topFunction() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('scroll', updateScrollProgress);
window.addEventListener('load', updateScrollProgress);

function updateScrollProgress() {
    const svg = document.getElementById('scrollProgressSvg');
    if (!svg) return;
    const circle = svg.querySelector('circle');
    if (!circle) return;

    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollRatio = scrollHeight === 0 ? 0 : scrollTop / scrollHeight;

    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - scrollRatio);

    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${offset}`;
}

/* ============================================
   SYNCHRONISATION GLOBALE DES DONNÉES
   ============================================ */

let _isLoggedInCache = null;
let _isLoggedInCacheTime = 0;
const CACHE_DURATION = 5000;

async function isUserLoggedIn() {
    const now = Date.now();
    if (_isLoggedInCache !== null && (now - _isLoggedInCacheTime) < CACHE_DURATION) {
        return _isLoggedInCache;
    }
    
    try {
        const response = await fetch('/api/get-data.php');
        const data = await response.json();
        _isLoggedInCache = data.logged_in === true;
        _isLoggedInCacheTime = now;
        return _isLoggedInCache;
    } catch (e) {
        return false;
    }
}

function invalidateLoginCache() {
    _isLoggedInCache = null;
    _isLoggedInCacheTime = 0;
}

function isOnProfilePage() {
    return window.location.pathname.includes('/profil');
}

function isScanUrl(url) {
    return url.includes('/scan/') || url.includes('/scans/') || url.includes('/s2/');
}

/* ============================================
   FONCTIONS LOCALSTORAGE
   ============================================ */

function getProgressFromLocal(url) {
    if (isScanUrl(url)) {
        const name = localStorage.getItem('savedChapName' + url);
        const num = localStorage.getItem('savedChapNb' + url);
        if (name || num) {
            return {
                name: name ? JSON.parse(name) : '',
                num: parseInt(num) || 0
            };
        }
    } else {
        const name = localStorage.getItem('savedEpName' + url);
        const num = localStorage.getItem('savedEpNb' + url);
        if (name || num) {
            return {
                name: name ? JSON.parse(name) : '',
                num: parseInt(num) || 0
            };
        }
    }
    return null;
}

function setProgressToLocal(url, name, num) {
    if (isScanUrl(url)) {
        localStorage.setItem('savedChapName' + url, JSON.stringify(name));
        localStorage.setItem('savedChapNb' + url, num);
    } else {
        localStorage.setItem('savedEpName' + url, JSON.stringify(name));
        localStorage.setItem('savedEpNb' + url, num);
    }
}

function getAllProgressFromLocal() {
    const progress = {};
    const processedUrls = new Set();
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        let url = null;
        let isScan = false;
        
        if (key.startsWith('savedChapName')) {
            url = key.replace('savedChapName', '');
            isScan = true;
        } else if (key.startsWith('savedEpName')) {
            url = key.replace('savedEpName', '');
            isScan = false;
        } else {
            continue;
        }
        
        if (processedUrls.has(url)) continue;
        processedUrls.add(url);
        
        const shouldUseScanKey = isScanUrl(url);
        
        if (shouldUseScanKey && !isScan) continue;
        if (!shouldUseScanKey && isScan) continue;
        
        const data = getProgressFromLocal(url);
        if (data) {
            progress[url] = data;
        }
    }
    
    return progress;
}

function setAllProgressToLocal(serverProgress) {
    for (const [url, data] of Object.entries(serverProgress || {})) {
        setProgressToLocal(url, data.name || '', data.num || 0);
    }
}

/* ============================================
   LOGIQUE PRINCIPALE
   ============================================ */

async function loadAllDataFromServer() {
    try {
        const response = await fetch('/api/get-data.php');
        const serverData = await response.json();

        if (!serverData.logged_in) {
            return false;
        }

        if (serverData.need_merge === true) {
            const localData = {
                progress: getAllProgressFromLocal(),
                favorites: {
                    nom: JSON.parse(localStorage.getItem('favoriNom')) || [],
                    url: JSON.parse(localStorage.getItem('favoriUrl')) || [],
                    img: JSON.parse(localStorage.getItem('favoriImg')) || []
                },
                watchlist: {
                    nom: JSON.parse(localStorage.getItem('watchlistNom')) || [],
                    url: JSON.parse(localStorage.getItem('watchlistUrl')) || [],
                    img: JSON.parse(localStorage.getItem('watchlistImg')) || []
                },
                viewed: {
                    nom: JSON.parse(localStorage.getItem('vuNom')) || [],
                    url: JSON.parse(localStorage.getItem('vuUrl')) || [],
                    img: JSON.parse(localStorage.getItem('vuImg')) || []
                },
                history: {
                    nom: JSON.parse(localStorage.getItem('histoNom')) || [],
                    url: JSON.parse(localStorage.getItem('histoUrl')) || [],
                    img: JSON.parse(localStorage.getItem('histoImg')) || [],
                    type: JSON.parse(localStorage.getItem('histoType')) || [],
                    lang: JSON.parse(localStorage.getItem('histoLang')) || [],
                    ep: JSON.parse(localStorage.getItem('histoEp')) || []
                }
            };

            try {
                const mergeResponse = await fetch('/api/merge-data.php', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(localData)
                });
                
                const mergeResult = await mergeResponse.json();
                
                if (mergeResult.merged) {
                    setAllProgressToLocal(mergeResult.merged.progress);
                    updateListsFromServer(mergeResult.merged);
                }
                
                if (isOnProfilePage()) {
                    window.location.reload();
                    return true;
                }
                
            } catch (mergeError) {
                // Silently fail
            }
            
        } else {
            setAllProgressToLocal(serverData.progress);
            updateListsFromServer(serverData);
        }

        if (typeof updateUI === 'function') updateUI();
        if (typeof updateUIAfterLoad === 'function') updateUIAfterLoad();

        return true;

    } catch (e) {
        return false;
    }
}

function updateListsFromServer(data) {
    if (data.favorites && data.favorites.nom) {
        localStorage.setItem('favoriNom', JSON.stringify(data.favorites.nom || []));
        localStorage.setItem('favoriUrl', JSON.stringify(data.favorites.url || []));
        localStorage.setItem('favoriImg', JSON.stringify(data.favorites.img || []));
    }

    if (data.watchlist && data.watchlist.nom) {
        localStorage.setItem('watchlistNom', JSON.stringify(data.watchlist.nom || []));
        localStorage.setItem('watchlistUrl', JSON.stringify(data.watchlist.url || []));
        localStorage.setItem('watchlistImg', JSON.stringify(data.watchlist.img || []));
    }

    if (data.viewed && data.viewed.nom) {
        localStorage.setItem('vuNom', JSON.stringify(data.viewed.nom || []));
        localStorage.setItem('vuUrl', JSON.stringify(data.viewed.url || []));
        localStorage.setItem('vuImg', JSON.stringify(data.viewed.img || []));
    }

    if (data.history && data.history.nom) {
        localStorage.setItem('histoNom', JSON.stringify(data.history.nom || []));
        localStorage.setItem('histoUrl', JSON.stringify(data.history.url || []));
        localStorage.setItem('histoImg', JSON.stringify(data.history.img || []));
        localStorage.setItem('histoType', JSON.stringify(data.history.type || []));
        localStorage.setItem('histoLang', JSON.stringify(data.history.lang || []));
        localStorage.setItem('histoEp', JSON.stringify(data.history.ep || []));
    }
}

/* ============================================
   FONCTIONS LEGACY (compatibilité)
   ============================================ */

function getLocalProgress() {
    return getAllProgressFromLocal();
}

function updateLocalStorageFromServer(serverData) {
    setAllProgressToLocal(serverData.progress || {});
    updateListsFromServer(serverData);
}

async function syncLocalProgressToServer() {
    const loggedIn = await isUserLoggedIn();
    if (!loggedIn) return;

    const progress = getAllProgressFromLocal();

    if (Object.keys(progress).length > 0) {
        fetch('/api/sync-progress.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({progress: progress})
        }).catch(() => {});
    }
}

async function syncMergedDataToServer() {
    const loggedIn = await isUserLoggedIn();
    if (!loggedIn) return;

    const favorites = {
        nom: JSON.parse(localStorage.getItem('favoriNom')) || [],
        url: JSON.parse(localStorage.getItem('favoriUrl')) || [],
        img: JSON.parse(localStorage.getItem('favoriImg')) || []
    };

    const watchlist = {
        nom: JSON.parse(localStorage.getItem('watchlistNom')) || [],
        url: JSON.parse(localStorage.getItem('watchlistUrl')) || [],
        img: JSON.parse(localStorage.getItem('watchlistImg')) || []
    };

    const viewed = {
        nom: JSON.parse(localStorage.getItem('vuNom')) || [],
        url: JSON.parse(localStorage.getItem('vuUrl')) || [],
        img: JSON.parse(localStorage.getItem('vuImg')) || []
    };

    const history = {
        nom: JSON.parse(localStorage.getItem('histoNom')) || [],
        url: JSON.parse(localStorage.getItem('histoUrl')) || [],
        img: JSON.parse(localStorage.getItem('histoImg')) || [],
        type: JSON.parse(localStorage.getItem('histoType')) || [],
        lang: JSON.parse(localStorage.getItem('histoLang')) || [],
        ep: JSON.parse(localStorage.getItem('histoEp')) || []
    };

    fetch('/api/sync-favorites.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({favorites})
    }).catch(() => {});

    fetch('/api/sync-watchlist.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({watchlist})
    }).catch(() => {});

    fetch('/api/sync-viewed.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({viewed})
    }).catch(() => {});

    fetch('/api/sync-history.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({history})
    }).catch(() => {});
}

async function initializeUserData() {
    await new Promise(resolve => setTimeout(resolve, 500));
    const dataLoaded = await loadAllDataFromServer();
    if (dataLoaded && typeof updateUIAfterLoad === 'function') {
        updateUIAfterLoad();
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadAllDataFromServer();
});