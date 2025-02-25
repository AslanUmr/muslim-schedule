document.addEventListener('DOMContentLoaded', () => {
  // ===========================
  // CONFIGURATION & TRANSLATION
  // ===========================
  const translations = {
    en: {
      prayers: {
        Fajr: "Fajr",
        Sunrise: "Sunrise",
        Dhuhr: "Dhuhr",
        Asr: "Asr",
        Maghrib: "Maghrib",
        Isha: "Isha"
      },
      time: {
        hours: "h",
        minutes: "m",
        in: "in"
      },
      freeTime: "Free Time"
    },
    ru: {
      prayers: {
        Fajr: "Фаджр",
        Sunrise: "Восход",
        Dhuhr: "Зухр",
        Asr: "Аср",
        Maghrib: "Магриб",
        Isha: "Иша"
      },
      time: {
        hours: "ч",
        minutes: "мин",
        in: "через"
      },
      freeTime: "Свободное время"
    },
    tr: {
      prayers: {
        Fajr: "İmsak",
        Sunrise: "Güneş",
        Dhuhr: "Öğle",
        Asr: "İkindi",
        Maghrib: "Akşam",
        Isha: "Yatsı"
      },
      time: {
        hours: "s",
        minutes: "dk",
        in: "kalan süre"
      },
      freeTime: "Boş zaman"
    },
    ar: {
      prayers: {
        Fajr: "الفجر",
        Sunrise: "الشروق",
        Dhuhr: "الظهر",
        Asr: "العصر",
        Maghrib: "المغرب",
        Isha: "العشاء"
      },
      time: {
        hours: "س",
        minutes: "د",
        in: "في"
      },
      freeTime: "وقت فراغ"
    }
  };

  // ===========================
  // DOM ELEMENTS & STATE
  // ===========================
  const currentLang = document.documentElement.lang || 'en';
  const prayerTranslations = translations[currentLang]?.prayers || translations.en.prayers;
  const timeTranslations = translations[currentLang]?.time || translations.en.time;
  const freeTimeText = translations[currentLang]?.freeTime || translations.en.freeTime;

  // DOM Elements
  const elements = {
    currentTime: document.getElementById('current-time'),
    currentLocation: document.getElementById('current-location'),
    prayerBlocks: document.getElementById('prayer-blocks'),
    addBlockBtn: document.getElementById('add-block-btn'),
    modal: document.getElementById('add-block-modal'),
    modalOverlay: document.getElementById('modal-overlay'),
    addBlockForm: document.getElementById('add-block-form'),
    cancelBtn: document.getElementById('cancel-btn'),
    submitBtn: document.getElementById('submit-btn'),
    modalTitle: document.getElementById('modal-title'),
    blockTitle: document.getElementById('block-title'),
    activityType: document.getElementById('activity-type'),
    blockStart: document.getElementById('block-start'),
    blockEnd: document.getElementById('block-end')
  };

  // Create countdown element
  const countdownDiv = document.createElement('div');
  countdownDiv.className = 'prayer-countdown';
  document.querySelector('.current-info').appendChild(countdownDiv);

  // Application State
  let state = {
    editingBlockId: null,
    prayerTimings: {},
    timeBlocks: loadTimeBlocks()
  };

  // ===========================
  // UTILITY FUNCTIONS
  // ===========================
  function saveTimeBlocks() {
    localStorage.setItem('timeBlocks', JSON.stringify(state.timeBlocks));
  }
  
  function loadTimeBlocks() {
    const saved = localStorage.getItem('timeBlocks');
    return saved ? JSON.parse(saved) : [];
  }

  function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    elements.addBlockForm.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
  }

  // ===========================
  // TIME CALCULATION FUNCTIONS
  // ===========================
  function isTimeOverlap(start1, end1, start2, end2) {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    return Math.max(s1, s2) < Math.min(e1, e2);
  }

  function findPrayerPeriod(timeStr) {
    const timeInMinutes = timeToMinutes(timeStr);
    const periods = Object.entries(state.prayerTimings).sort((a, b) => 
      timeToMinutes(a[1]) - timeToMinutes(b[1])
    );

    // Return the current prayer period
    for (let i = 0; i < periods.length - 1; i++) {
      const currentPrayerTime = timeToMinutes(periods[i][1]);
      const nextPrayerTime = timeToMinutes(periods[i + 1][1]);
      
      if (timeInMinutes >= currentPrayerTime && timeInMinutes < nextPrayerTime) {
        return periods[i][0];
      }
    }
    
    // If time is after the last prayer of the day, return the last prayer
    return periods[periods.length - 1][0];
  }

  function isCurrentTimeBlock(startTime, endTime) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  function hasTimeConflict(startTime, endTime, ignoreId = null) {
    return state.timeBlocks.some(block => {
      if (block.id === ignoreId) return false;
      return isTimeOverlap(startTime, endTime, block.startTime, block.endTime);
    });
  }

  function calculateFreeTime() {
    // Sort blocks by start time
    const sortedBlocks = [...state.timeBlocks].sort((a, b) => 
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    const freeTimeSlots = [];
    
    for (let i = 0; i < sortedBlocks.length - 1; i++) {
      const currentBlock = sortedBlocks[i];
      const nextBlock = sortedBlocks[i + 1];
      
      const currentEndMinutes = timeToMinutes(currentBlock.endTime);
      const nextStartMinutes = timeToMinutes(nextBlock.startTime);
      
      if (nextStartMinutes - currentEndMinutes > 0) {
        freeTimeSlots.push({
          startTime: currentBlock.endTime,
          endTime: nextBlock.startTime,
          duration: nextStartMinutes - currentEndMinutes,
          prayer: findPrayerPeriod(currentBlock.endTime)
        });
      }
    }

    return freeTimeSlots;
  }

  function splitActivityAcrossPrayers(title, startTime, endTime) {
    const splits = [];
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    const prayerTimes = Object.entries(state.prayerTimings)
      .map(([name, time]) => ({ name, minutes: timeToMinutes(time) }))
      .sort((a, b) => a.minutes - b.minutes);

    let currentStart = startMinutes;
    
    for (const prayer of prayerTimes) {
      if (prayer.minutes > currentStart && prayer.minutes < endMinutes) {
        splits.push({
          title,
          startTime: minutesToTime(currentStart),
          endTime: minutesToTime(prayer.minutes),
          prayer: findPrayerPeriod(minutesToTime(currentStart)),
          split: true,
          done: false
        });
        currentStart = prayer.minutes;
      }
    }
    
    if (currentStart < endMinutes) {
      splits.push({
        title,
        startTime: minutesToTime(currentStart),
        endTime: minutesToTime(endMinutes),
        prayer: findPrayerPeriod(minutesToTime(currentStart)),
        split: splits.length > 0,
        done: false
      });
    }
    
    return splits;
  }

  // ===========================
  // UI RENDERING FUNCTIONS
  // ===========================
  function createTimeBlock(block) {
    const isCurrentBlock = isCurrentTimeBlock(block.startTime, block.endTime);
    return `
      <div class="time-block ${block.split ? 'split' : ''} ${isCurrentBlock ? 'current-block' : ''} ${block.done ? 'done' : ''}" 
           data-id="${block.id}" 
           data-type="${block.type || 'other'}"
           data-start="${block.startTime}"
           data-end="${block.endTime}">
        <div>
          <label class="done-checkbox">
            <input type="checkbox" ${block.done ? 'checked' : ''}>
            <strong>${block.title}</strong>
          </label>
          <div>${block.startTime} - ${block.endTime}</div>
        </div>
        <div class="actions">
          <button class="edit-btn">✎</button>
          <button class="remove-btn">×</button>
        </div>
        ${block.conflict ? '<div class="conflict-indicator">Conflict!</div>' : ''}
      </div>
    `;
  }

  function createFreeTimeBlock(slot) {
    return `
      <div class="free-time-block" 
           data-start="${slot.startTime}" 
           data-end="${slot.endTime}"
           data-prayer="${slot.prayer}">
        <div>
          ${freeTimeText} (${Math.floor(slot.duration / 60)}${timeTranslations.hours} ${slot.duration % 60}${timeTranslations.minutes})
          <div>${slot.startTime} - ${slot.endTime}</div>
        </div>
        <button class="add-to-free-time-btn">+</button>
      </div>
    `;
  }

  function updatePrayerCountdown() {
    // Check if prayer timings exist
    if (!state.prayerTimings || Object.keys(state.prayerTimings).length === 0) {
      countdownDiv.innerHTML = "Loading prayer times...";
      return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const prayerTimes = Object.entries(state.prayerTimings)
      .map(([name, time]) => ({
        name,
        minutes: timeToMinutes(time)
      }))
      .sort((a, b) => a.minutes - b.minutes);

    // Find the next prayer
    let nextPrayer = prayerTimes.find(prayer => prayer.minutes > currentMinutes);
    
    // If no next prayer today, use the first prayer of tomorrow
    if (!nextPrayer && prayerTimes.length > 0) {
      nextPrayer = prayerTimes[0];
    }

    // If we still don't have a next prayer, return early
    if (!nextPrayer) {
      countdownDiv.innerHTML = "No prayer times available";
      return;
    }

    let minutesUntil = nextPrayer.minutes - currentMinutes;
    if (minutesUntil < 0) {
      minutesUntil += 24 * 60; // Add 24 hours if it's tomorrow
    }

    const hoursUntil = Math.floor(minutesUntil / 60);
    const minsUntil = minutesUntil % 60;

    const translatedName = prayerTranslations[nextPrayer.name] || nextPrayer.name;
    
    let countdownText;
    if (currentLang === 'ar') {
      // Arabic format (right-to-left)
      countdownText = `${translatedName} ${timeTranslations.in} ${hoursUntil}${timeTranslations.hours} ${minsUntil}${timeTranslations.minutes}`;
    } else if (currentLang === 'ru') {
      // Russian format
      countdownText = `${translatedName} ${timeTranslations.in} ${hoursUntil}${timeTranslations.hours} ${minsUntil}${timeTranslations.minutes}`;
    } else if (currentLang === 'tr') {
      // Turkish format
      countdownText = `${translatedName}'a ${hoursUntil}${timeTranslations.hours} ${minsUntil}${timeTranslations.minutes} ${timeTranslations.in}`;
    } else {
      // Default English format
      countdownText = `${translatedName} ${timeTranslations.in} ${hoursUntil}${timeTranslations.hours} ${minsUntil}${timeTranslations.minutes}`;
    }

    countdownDiv.innerHTML = countdownText;
  }

  function updateCurrentBlocks() {
    // Only update the current block status without rebuilding
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    document.querySelectorAll('.time-block').forEach(block => {
      const blockId = parseFloat(block.dataset.id);
      const blockData = state.timeBlocks.find(b => b.id === blockId);
      if (blockData) {
        const startMinutes = timeToMinutes(blockData.startTime);
        const endMinutes = timeToMinutes(blockData.endTime);
        
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          block.classList.add('current-block');
        } else {
          block.classList.remove('current-block');
        }
      }
    });
  }

  function updatePrayerBlocks(prayers) {
    elements.prayerBlocks.innerHTML = '';
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Create prayer blocks
    prayers.forEach((prayer, index) => {
      const [hour, minute] = prayer.time.split(':').map(Number);
      const nextPrayer = prayers[index + 1];
      
      // Determine if this is the current prayer period
      const isCurrent = (currentHour === hour && currentMinute >= minute) || 
                       (currentHour > hour && (!nextPrayer || 
                        currentHour < parseInt(nextPrayer.time.split(':')[0])));

      const translatedName = prayerTranslations[prayer.name] || prayer.name;

      const block = document.createElement('div');
      block.className = `prayer-block${isCurrent ? ' current' : ''}`;
      block.innerHTML = `
        <h3>${translatedName}</h3>
        <div class="prayer-time">${prayer.time}</div>
        <div class="time-blocks" data-prayer="${prayer.name}"></div>
      `;
      elements.prayerBlocks.appendChild(block);
    });

    // Get all time blocks including both regular blocks and free time
    const allTimeSlots = [];
    
    // Add existing task blocks
    state.timeBlocks.forEach(block => {
      allTimeSlots.push({
        type: 'task',
        data: block,
        startTime: timeToMinutes(block.startTime),
        endTime: timeToMinutes(block.endTime),
        prayer: block.prayer
      });
    });
    
    // Add free time blocks
    const freeTimeSlots = calculateFreeTime();
    freeTimeSlots.forEach(slot => {
      allTimeSlots.push({
        type: 'free',
        data: slot,
        startTime: timeToMinutes(slot.startTime),
        endTime: timeToMinutes(slot.endTime),
        prayer: slot.prayer
      });
    });
    
    // Sort all slots by start time
    allTimeSlots.sort((a, b) => a.startTime - b.startTime);
    
    // Add blocks in order to prayer containers
    allTimeSlots.forEach(slot => {
      const container = document.querySelector(`.time-blocks[data-prayer="${slot.prayer}"]`);
      if (container) {
        if (slot.type === 'task') {
          container.insertAdjacentHTML('beforeend', createTimeBlock(slot.data));
        } else {
          container.insertAdjacentHTML('beforeend', createFreeTimeBlock(slot.data));
        }
      }
    });
  }

  function updateClock() {
    const now = new Date();
    elements.currentTime.textContent = now.toLocaleTimeString();
  }

  function updateDisplay() {
    if (Object.keys(state.prayerTimings).length === 0) {
      return; // Don't update if we don't have prayer times yet
    }

    const prayers = Object.entries(state.prayerTimings).map(([name, time]) => ({
      name,
      time
    }));
    updatePrayerBlocks(prayers);
    updateCurrentBlocks();
  }

  // ===========================
  // MODAL FUNCTIONS
  // ===========================
  function closeModal() {
    elements.modal.classList.add('hidden');
    elements.modalOverlay.classList.add('hidden');
    elements.addBlockForm.reset();
    state.editingBlockId = null;
  }

  function openModal() {
    elements.modal.classList.remove('hidden');
    elements.modalOverlay.classList.remove('hidden');
  }

  function openModalWithTimes(startTime, endTime) {
    elements.blockStart.value = startTime;
    elements.blockEnd.value = endTime;
    elements.modalTitle.textContent = 'Add Time Block';
    elements.submitBtn.textContent = 'Add';
    openModal();
  }

  function editBlock(blockId) {
    const block = state.timeBlocks.find(b => b.id === blockId);
    if (block) {
      state.editingBlockId = blockId;
      elements.blockTitle.value = block.title;
      elements.activityType.value = block.type || 'other';
      elements.blockStart.value = block.startTime;
      elements.blockEnd.value = block.endTime;
      elements.modalTitle.textContent = 'Edit Time Block';
      elements.submitBtn.textContent = 'Update';
      openModal();
    }
  }

  function removeBlock(blockId) {
    state.timeBlocks = state.timeBlocks.filter(b => b.id !== blockId);
    saveTimeBlocks();
    updateDisplay();
  }

  // ===========================
  // DATA FETCHING FUNCTIONS
  // ===========================
  async function fetchPrayerTimes(lat, lng) {
    try {
      // Get the appropriate calculation method based on location
      const locationResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}`);
      const locationData = await locationResponse.json();
      
      // Define calculation method based on location
      let method = 2; // Default ISNA method
      let adjustments = "0,0,0,0,0,0,0,0,0"; // Default no adjustments
      
      // Common calculation methods by region
      if (locationData.countryCode === 'TR') method = 13; // Turkey
      else if (['AE', 'SA', 'KW', 'QA'].includes(locationData.countryCode)) method = 4; // Umm Al-Qura
      else if (locationData.countryCode === 'EG') method = 5; // Egyptian General Authority
      else if (['PK', 'IN', 'BD'].includes(locationData.countryCode)) method = 1; // Karachi
      else if (['SG', 'MY', 'ID'].includes(locationData.countryCode)) method = 3; // Muslim World League
      else if (locationData.countryCode === 'KZ') {
        // Kazakhstan - using Muslim World League method (3) with specific adjustments
        method = 3;
        // Apply Kazakhstan-specific adjustments (in minutes)
        // Format: Fajr,Sunrise,Dhuhr,Asr,Sunset,Maghrib,Isha
        adjustments = "20,-5,5,5,0,5,-13"; // Example: +5 min for Fajr, +15 for Maghrib and Isha
      }
      
      // Make the API call with additional parameters for more accuracy
      const response = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}` +
        `&method=${method}` +
        `&adjustment=1` + // Consider daylight savings
        `&tune=${adjustments}` + // Fine-tune specific prayer times
        `&school=0` // 0 for Shafi (Standard), 1 for Hanafi
      );
      
      const data = await response.json();
      const timings = data.data.timings;
      
      state.prayerTimings = {
        Fajr: timings.Fajr,
        Sunrise: timings.Sunrise,
        Dhuhr: timings.Dhuhr,
        Asr: timings.Asr,
        Maghrib: timings.Maghrib,
        Isha: timings.Isha
      };
  
      const prayers = Object.entries(state.prayerTimings).map(([name, time]) => ({
        name,
        time
      }));
  
      updatePrayerBlocks(prayers);
      updatePrayerCountdown(); // Update countdown immediately after receiving prayer times
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      // Fallback to ISNA method if there's an error
      try {
        const response = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=2`);
        const data = await response.json();
        const timings = data.data.timings;
        
        state.prayerTimings = {
          Fajr: timings.Fajr,
          Sunrise: timings.Sunrise,
          Dhuhr: timings.Dhuhr,
          Asr: timings.Asr,
          Maghrib: timings.Maghrib,
          Isha: timings.Isha
        };
  
        const prayers = Object.entries(state.prayerTimings).map(([name, time]) => ({
          name,
          time
        }));
  
        updatePrayerBlocks(prayers);
        updatePrayerCountdown();
      } catch (fallbackError) {
        console.error('Error with fallback prayer times:', fallbackError);
        countdownDiv.innerHTML = "Could not load prayer times";
      }
    }
  }

  async function getLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async position => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}`);
            const data = await response.json();
            elements.currentLocation.textContent = `${data.city}, ${data.countryName}`;
            fetchPrayerTimes(latitude, longitude);
          } catch (error) {
            console.error('Error getting location:', error);
            elements.currentLocation.textContent = 'Location unavailable';
            fetchPrayerTimes(41.0082, 28.9784); // Istanbul coordinates as fallback
          }
        },
        error => {
          console.error('Error getting position:', error);
          elements.currentLocation.textContent = 'Location unavailable';
          fetchPrayerTimes(41.0082, 28.9784); // Istanbul coordinates as fallback
        }
      );
    } else {
      elements.currentLocation.textContent = 'Geolocation not supported';
      fetchPrayerTimes(41.0082, 28.9784); // Istanbul coordinates as fallback
    }
  }

  // ===========================
  // EVENT HANDLERS
  // ===========================
  // Modal Form Submission
  elements.addBlockForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = elements.blockTitle.value;
    const type = elements.activityType.value;
    const startTime = elements.blockStart.value;
    const endTime = elements.blockEnd.value;

    if (hasTimeConflict(startTime, endTime, state.editingBlockId)) {
      showError('This time slot is already occupied');
      return;
    }

    if (state.editingBlockId) {
      const updatedBlock = {
        id: state.editingBlockId,
        title,
        type,
        startTime,
        endTime,
        prayer: findPrayerPeriod(startTime)
      };
      
      state.timeBlocks = state.timeBlocks.map(block => 
        block.id === state.editingBlockId ? updatedBlock : block
      );
      saveTimeBlocks();
    } else {
      const splits = splitActivityAcrossPrayers(title, startTime, endTime);
      splits.forEach(split => {
        const blockId = Date.now() + Math.random();
        state.timeBlocks.push({
          id: blockId,
          type,
          ...split
        });
      });
      saveTimeBlocks();
    }

    updateDisplay();
    closeModal();
    
    // Reset modal to add mode
    elements.modalTitle.textContent = 'Add Time Block';
    elements.submitBtn.textContent = 'Add';
    state.editingBlockId = null;
  });

  // Click event delegation for all interactive elements
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const blockId = parseFloat(e.target.closest('.time-block').dataset.id);
      editBlock(blockId);
    } else if (e.target.classList.contains('remove-btn')) {
      const blockId = parseFloat(e.target.closest('.time-block').dataset.id);
      removeBlock(blockId);
    } else if (e.target.classList.contains('add-to-free-time-btn') || 
              (e.target.closest('.free-time-block') && !e.target.classList.contains('actions'))) {
      // Get the free time block
      const freeTimeBlock = e.target.closest('.free-time-block');
      if (freeTimeBlock) {
        const startTime = freeTimeBlock.dataset.start;
        const endTime = freeTimeBlock.dataset.end;
        openModalWithTimes(startTime, endTime);
      }
    }
  });

  // Checkbox state change
  document.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
      const blockId = parseFloat(e.target.closest('.time-block').dataset.id);
      const block = state.timeBlocks.find(b => b.id === blockId);
      if (block) {
        block.done = e.target.checked;
        saveTimeBlocks();
        updateDisplay();
      }
    }
  });

  // Modal open/close
  elements.addBlockBtn.addEventListener('click', openModal);
  elements.cancelBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission
    closeModal();
  });
  elements.modalOverlay.addEventListener('click', closeModal);

  // ===========================
  // INITIALIZATION
  // ===========================
  // Initialize clock and update time
  setInterval(() => {
    updateClock();
    updatePrayerCountdown();
    updateCurrentBlocks();
  }, 1000);
  
  updateClock();
  
  // Get location and prayer times
  getLocation();
});