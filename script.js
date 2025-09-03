document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const screen = document.getElementById('screen');
    const audioPlayer = document.getElementById('audio-player');
    const playPauseButton = document.querySelector('.play-pause-button');
    const forwardButton = document.querySelector('.forward-button');
    const backwardButton = document.querySelector('.backward-button');
    const centerButton = document.querySelector('.center-button');
    const menuButton = document.querySelector('.menu-button');
    const clickWheel = document.querySelector('.click-wheel');

    // --- Data ---
    const playlist = [
        { title: 'Furious Freak', artist: 'Kevin MacLeod', src: 'https://dl.espressif.com/dl/audio/ff-16b-2c-44100hz.mp3', type: 'audio/mpeg' },
        { title: 'Galway', artist: 'Kevin MacLeod', src: 'https://dl.espressif.com/dl/audio/gs-16b-2c-44100hz.mp3', type: 'audio/mpeg' },
        { title: 'Furious Freak (FLAC)', artist: 'Kevin MacLeod', src: 'https://dl.espressif.com/dl/audio/ff-16b-2c-44100hz.flac', type: 'audio/flac' }
    ];
    const radioStations = [
        { name: 'Radio Disney FM', src: '#' },
        { name: 'JC Radio La Bruja', src: '#' },
        { name: 'La Otra FM', src: '#' },
        { name: 'Exa FM', src: '#' }
    ];

    // --- State ---
    let currentTrackIndex = 0;
    let isPlaying = false;
    let activeMenuIndex = 0;
    let currentMenu = { items: [] };
    let screenStack = ['main'];

    // --- Web Audio API Setup ---
    let audioContext;
    let audioSource;
    let eqBands = [];

    function setupAudioContext() {
        if (audioContext) return;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioSource = audioContext.createMediaElementSource(audioPlayer);

        const frequencies = [60, 250, 1000, 4000, 10000];
        let lastNode = audioSource;

        frequencies.forEach((freq, i) => {
            const eqNode = audioContext.createBiquadFilter();
            eqNode.frequency.value = freq;
            eqNode.type = (i === 0) ? 'lowshelf' : (i === frequencies.length - 1) ? 'highshelf' : 'peaking';
            eqNode.gain.value = 0;

            lastNode.connect(eqNode);
            lastNode = eqNode;
            eqBands.push(eqNode);
        });

        lastNode.connect(audioContext.destination);
    }

    // --- Audio Logic ---
    function loadTrack(track) {
        audioPlayer.src = track.src;
        audioPlayer.type = track.type || 'audio/mpeg';
    }

    function togglePlayPause() {
        if (!audioContext) setupAudioContext();
        isPlaying = !isPlaying;
        if (isPlaying) {
            audioPlayer.play();
            playPauseButton.textContent = '||';
        } else {
            audioPlayer.pause();
            playPauseButton.textContent = '▶';
        }
    }

    function playAudio() {
        if (!audioContext) setupAudioContext();
        isPlaying = true;
        audioPlayer.play();
        playPauseButton.textContent = '||';
    }

    function nextTrack() {
        currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
        loadTrack(playlist[currentTrackIndex]);
        if(isPlaying) playAudio();
    }

    function prevTrack() {
        currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
        loadTrack(playlist[currentTrackIndex]);
        if(isPlaying) playAudio();
    }

    // --- UI & Menu Logic ---
    function renderMenu(menu) {
        screenStack.push(menu.id);
        currentMenu = menu;
        activeMenuIndex = 0;

        let content = `<div class="screen-header">${menu.title}</div>`;
        if (menu.render) {
            content += menu.render();
        } else {
            let listItems = menu.items.map((item, index) =>
                `<li class="menu-item ${index === 0 ? 'active' : ''}" data-index="${index}">${item.title}</li>`
            ).join('');
            content += `<ul class="menu-list">${listItems}</ul>`;
        }
        screen.innerHTML = content;
        updateActiveMenuItem();
    }

    const menus = {
        main: {
            id: 'main',
            title: 'iPod',
            items: [
                { title: 'Música', action: () => renderMenu(menus.music) },
                { title: 'Radio', action: () => renderMenu(menus.radio) },
                { title: 'Ajustes', action: () => renderMenu(menus.settings) }
            ]
        },
        music: {
            id: 'music',
            title: 'Música',
            items: playlist.map(song => ({ title: song.title, action: (index) => {
                currentTrackIndex = index;
                loadTrack(playlist[index]);
                playAudio();
            }}))
        },
        radio: {
            id: 'radio',
            title: 'Radio Ecuador',
            items: radioStations.map(station => ({ title: station.name, action: (index) => {
                loadTrack(radioStations[index]);
                playAudio();
            }}))
        },
        settings: {
            id: 'settings',
            title: 'Ajustes',
            items: [
                { title: 'Ecualizador', action: () => renderMenu(menus.equalizer) }
            ]
        },
        equalizer: {
            id: 'equalizer',
            title: 'Ecualizador',
            render: () => {
                const bandsHtml = eqBands.map((band, index) => `
                    <div class="menu-item eq-band" data-index="${index}">
                        <span>${band.frequency.value}Hz</span>
                        <input type="range" min="-12" max="12" value="${band.gain.value}" step="1" class="eq-slider">
                    </div>
                `).join('');
                return `<div class="eq-container">${bandsHtml}</div>`;
            },
            items: eqBands.map((band, i) => ({ title: `${band.frequency.value} Hz` })) // for navigation
        }
    };

    function updateActiveMenuItem() {
        const menuItems = screen.querySelectorAll('.menu-item');
        menuItems.forEach((item, index) => {
            item.classList.toggle('active', index === activeMenuIndex);
        });
    }

    function handleMenuNavigation(direction) {
        if (currentMenu.id === 'equalizer') {
            const sliders = screen.querySelectorAll('.eq-slider');
            const currentSlider = sliders[activeMenuIndex];
            let currentValue = parseInt(currentSlider.value, 10);
            currentSlider.value = Math.max(-12, Math.min(12, currentValue + direction));
            eqBands[activeMenuIndex].gain.value = currentSlider.value;
        } else {
            activeMenuIndex = (activeMenuIndex + direction + currentMenu.items.length) % currentMenu.items.length;
            updateActiveMenuItem();
        }
    }

    function handleMenuSelect() {
        const selectedItem = currentMenu.items[activeMenuIndex];
        if (selectedItem && selectedItem.action) {
            selectedItem.action(activeMenuIndex);
        }
    }

    function handleMenuBack() {
        screenStack.pop();
        const previousScreenId = screenStack[screenStack.length - 1] || 'main';
        // A bit of a hack to find the menu object by its ID
        const menuId = Object.keys(menus).find(key => menus[key].id === previousScreenId);
        if (menuId) {
            renderMenu(menus[menuId]);
        } else {
            renderMenu(menus.main);
        }
    }

    // --- Click Wheel Simulation ---
    let isDragging = false;
    let lastAngle = 0;
    let accumulatedAngle = 0;

    function getAngle(event) {
        const rect = clickWheel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI;
    }

    function handleWheelRotation(direction) {
        if (currentMenu.id === 'equalizer') {
             // In EQ menu, the wheel changes the active slider, not the value
            activeMenuIndex = (activeMenuIndex + direction + eqBands.length) % eqBands.length;
            updateActiveMenuItem();
        } else {
            handleMenuNavigation(direction);
        }
    }

    // Forward/backward buttons control slider values in EQ screen
    forwardButton.addEventListener('click', () => currentMenu.id === 'equalizer' ? handleMenuNavigation(1) : nextTrack());
    backwardButton.addEventListener('click', () => currentMenu.id === 'equalizer' ? handleMenuNavigation(-1) : prevTrack());

    clickWheel.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastAngle = getAngle(e);
        accumulatedAngle = 0;
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
    clickWheel.addEventListener('mouseleave', () => { isDragging = false; });

    clickWheel.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const currentAngle = getAngle(e);
            let angleDiff = currentAngle - lastAngle;
            if (Math.abs(angleDiff) > 180) {
                angleDiff = angleDiff > 0 ? angleDiff - 360 : angleDiff + 360;
            }
            accumulatedAngle += angleDiff;
            lastAngle = currentAngle;

            if (Math.abs(accumulatedAngle) > 20) { // Increased sensitivity for EQ
                const direction = accumulatedAngle > 0 ? 1 : -1;
                handleWheelRotation(direction);
                accumulatedAngle = 0;
            }
        }
    });

    // --- Initial Setup & Event Listeners ---
    loadTrack(playlist[currentTrackIndex]);
    renderMenu(menus.main);

    playPauseButton.addEventListener('click', togglePlayPause);
    centerButton.addEventListener('click', handleMenuSelect);
    menuButton.addEventListener('click', handleMenuBack);
});
