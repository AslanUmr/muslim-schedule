document.addEventListener('DOMContentLoaded', () => {

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
  const currentLang = document.documentElement.lang || 'en';
  const prayerTranslations = translations[currentLang]?.prayers || translations.en.prayers;
  const freeTimeText = translations[currentLang]?.freeTime || translations.en.freeTime;

  const currentTime = document.getElementById('current-time');
  const currentLocation = document.getElementById('current-location');
  const prayerBlocks = document.getElementById('prayer-blocks');
  const addBlockBtn = document.getElementById('add-block-btn');
  const modal = document.getElementById('add-block-modal');
  const modalOverlay = document.getElementById('modal-overlay');
  const addBlockForm = document.getElementById('add-block-form');
  const cancelBtn = document.getElementById('cancel-btn');
  const submitBtn = document.getElementById('submit-btn');

  let editingBlockId = null;
  let prayerTimings = {};
  let timeBlocks = loadTimeBlocks();

  // Add countdown element to current-info div
  const currentInfo = document.querySelector('.current-info');
  const countdownDiv = document.createElement('div');
  countdownDiv.className = 'prayer-countdown';
  currentInfo.appendChild(countdownDiv);

 // Helper Functions

  function saveTimeBlocks() {
    localStorage.setItem('timeBlocks', JSON.stringify(timeBlocks));
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

  function updatePrayerCountdown() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const prayerTimes = Object.entries(prayerTimings)
      .map(([name, time]) => ({
        name,
        minutes: timeToMinutes(time)
      }))
      .sort((a, b) => a.minutes - b.minutes);

    let nextPrayer = prayerTimes.find(prayer => prayer.minutes > currentMinutes);
    
    if (!nextPrayer) {
      nextPrayer = prayerTimes[0];
    }

    let minutesUntil = nextPrayer.minutes - currentMinutes;
    if (minutesUntil < 0) {
      minutesUntil += 24 * 60;
    }

    const hoursUntil = Math.floor(minutesUntil / 60);
    const minsUntil = minutesUntil % 60;

    const translatedName = prayerTranslations[nextPrayer.name] || nextPrayer.name;
    const timeTranslations = translations[currentLang]?.time || translations.en.time;
    
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

  function isTimeOverlap(start1, end1, start2, end2) {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    return Math.max(s1, s2) < Math.min(e1, e2);
  }

  function findPrayerPeriod(timeStr) {
    const timeInMinutes = timeToMinutes(timeStr);
    const periods = Object.entries(prayerTimings).sort((a, b) => 
      timeToMinutes(a[1]) - timeToMinutes(b[1])
    );

    for (let i = 0; i < periods.length - 1; i++) {
      const currentPrayerTime = timeToMinutes(periods[i][1]);
      const nextPrayerTime = timeToMinutes(periods[i + 1][1]);
      
      if (timeInMinutes >= currentPrayerTime && timeInMinutes < nextPrayerTime) {
        return periods[i][0];
      }
    }
    
    return periods[periods.length - 1][0];
  }

  function isCurrentTimeBlock(startTime, endTime) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  function createTimeBlock(block) {
    const isCurrentBlock = isCurrentTimeBlock(block.startTime, block.endTime);
    return `
      <div class="time-block ${block.split ? 'split' : ''} ${isCurrentBlock ? 'current-block' : ''} ${block.done ? 'done' : ''}" 
           data-id="${block.id}" 
           data-type="${block.type}"
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
          ${freeTimeText} (${Math.floor(slot.duration / 60)}${translations[currentLang]?.time.hours || 'h'} ${slot.duration % 60}${translations[currentLang]?.time.minutes || 'm'})
          <div>${slot.startTime} - ${slot.endTime}</div>
        </div>
        <button class="add-to-free-time-btn">+</button>
      </div>
    `;
  }

  function splitActivityAcrossPrayers(title, startTime, endTime) {
    const splits = [];
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    const prayerTimes = Object.entries(prayerTimings)
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
        split: splits.length > 0
      });
    }
    
    return splits;
  }

  function hasTimeConflict(startTime, endTime, ignoreId = null) {
    return timeBlocks.some(block => {
      if (block.id === ignoreId) return false;
      return isTimeOverlap(startTime, endTime, block.startTime, block.endTime);
    });
  }

  function calculateFreeTime() {
    // Sort blocks by start time
    const sortedBlocks = [...timeBlocks].sort((a, b) => 
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

  function updateCurrentBlocks() {
    // Only update the current block status without rebuilding
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    document.querySelectorAll('.time-block').forEach(block => {
      const blockData = timeBlocks.find(b => b.id === parseFloat(block.dataset.id));
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
  
  // Core Functions
  async function fetchPrayerTimes(lat, lng) {
    try {
      // Get the appropriate calculation method based on location
      const methodResponse = await fetch(`https://api.aladhan.com/v1/methods`);
      const methodData = await methodResponse.json();
      
      // First, try to get the location info to determine the appropriate method
      const locationResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}`);
      const locationData = await locationResponse.json();
      
      // Define calculation method based on location
      let method = 2; // Default ISNA method
      
      // Common calculation methods by region
      if (locationData.countryCode === 'TR') method = 13; // Turkey
      else if (locationData.countryCode === 'AE' || 
               locationData.countryCode === 'SA' || 
               locationData.countryCode === 'KW' || 
               locationData.countryCode === 'QA') method = 4; // Umm Al-Qura
      else if (locationData.countryCode === 'EG') method = 5; // Egyptian General Authority
      else if (locationData.countryCode === 'PK' || 
               locationData.countryCode === 'IN' || 
               locationData.countryCode === 'BD') method = 1; // Karachi
      else if (locationData.countryCode === 'SG' || 
               locationData.countryCode === 'MY' || 
               locationData.countryCode === 'ID') method = 3; // Muslim World League
      
      // Make the API call with additional parameters for more accuracy
      const response = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}` +
        `&method=${method}` +
        `&adjustment=1` + // Consider daylight savings
        `&tune=0,0,0,0,0,0,0,0,0` + // Fine-tune specific prayer times if needed
        `&school=0` // 0 for Shafi (Standard), 1 for Hanafi
      );
      
      const data = await response.json();
      const timings = data.data.timings;
      
      prayerTimings = {
        Fajr: timings.Fajr,
        Sunrise: timings.Sunrise,
        Dhuhr: timings.Dhuhr,
        Asr: timings.Asr,
        Maghrib: timings.Maghrib,
        Isha: timings.Isha
      };
  
      const prayers = Object.entries(prayerTimings).map(([name, time]) => ({
        name,
        time
      }));
  
      updatePrayerBlocks(prayers);
    } catch (error) {
      console.error('Error fetching prayer times:', error);
      // Fallback to ISNA method if there's an error
      try {
        const response = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=2`);
        const data = await response.json();
        const timings = data.data.timings;
        
        prayerTimings = {
          Fajr: timings.Fajr,
          Sunrise: timings.Sunrise,
          Dhuhr: timings.Dhuhr,
          Asr: timings.Asr,
          Maghrib: timings.Maghrib,
          Isha: timings.Isha
        };
  
        const prayers = Object.entries(prayerTimings).map(([name, time]) => ({
          name,
          time
        }));
  
        updatePrayerBlocks(prayers);
      } catch (fallbackError) {
        console.error('Error with fallback prayer times:', fallbackError);
      }
    }
  }

  function updatePrayerBlocks(prayers) {
    prayerBlocks.innerHTML = '';
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Create prayer blocks
    prayers.forEach(prayer => {
      const [hour, minute] = prayer.time.split(':').map(Number);
      const isCurrent = (currentHour === hour && currentMinute >= minute) || 
                       (currentHour > hour && (prayers[prayers.indexOf(prayer) + 1] ? 
                        currentHour < prayers[prayers.indexOf(prayer) + 1].time.split(':')[0] : true));

      const translatedName = prayerTranslations[prayer.name] || prayer.name;

      const block = document.createElement('div');
      block.className = `prayer-block${isCurrent ? ' current' : ''}`;
      block.innerHTML = `
        <h3>${translatedName}</h3>
        <div class="prayer-time">${prayer.time}</div>
        <div class="time-blocks" data-prayer="${prayer.name}"></div>
      `;
      prayerBlocks.appendChild(block);
    });

    // Get all time blocks including both regular blocks and free time
    const allTimeSlots = [];
    
    // Add existing task blocks
    timeBlocks.forEach(block => {
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

  function updateDisplay() {
    const prayers = Object.entries(prayerTimings).map(([name, time]) => ({
      name,
      time
    }));
    updatePrayerBlocks(prayers);
    updateCurrentBlocks();
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    addBlockForm.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
  }

  // Event Handlers
  function updateClock() {
    const now = new Date();
    currentTime.textContent = now.toLocaleTimeString();
  }

  function closeModal() {
    modal.classList.add('hidden');
    modalOverlay.classList.add('hidden');
    addBlockForm.reset();
    editingBlockId = null;
  }

  function openModalWithTimes(startTime, endTime) {
    document.getElementById('block-start').value = startTime;
    document.getElementById('block-end').value = endTime;
    document.getElementById('modal-title').textContent = 'Add Time Block';
    submitBtn.textContent = 'Add';
    openModal();
  }

  function editBlock(blockId) {
    const block = timeBlocks.find(b => b.id === blockId);
    if (block) {
      editingBlockId = blockId;
      document.getElementById('block-title').value = block.title;
      document.getElementById('activity-type').value = block.type || 'other';
      document.getElementById('block-start').value = block.startTime;
      document.getElementById('block-end').value = block.endTime;
      document.getElementById('modal-title').textContent = 'Edit Time Block';
      submitBtn.textContent = 'Update';
      openModal();
    }
  }

  addBlockForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('block-title').value;
    const type = document.getElementById('activity-type').value;
    const startTime = document.getElementById('block-start').value;
    const endTime = document.getElementById('block-end').value;

    if (hasTimeConflict(startTime, endTime, editingBlockId)) {
      showError('This time slot is already occupied');
      return;
    }

    if (editingBlockId) {
      const updatedBlock = {
        id: editingBlockId,
        title,
        type,
        startTime,
        endTime,
        prayer: findPrayerPeriod(startTime)
      };
      
      timeBlocks = timeBlocks.map(block => 
        block.id === editingBlockId ? updatedBlock : block
      );
      saveTimeBlocks();
    } else {
      const splits = splitActivityAcrossPrayers(title, startTime, endTime);
      splits.forEach(split => {
        const blockId = Date.now() + Math.random();
        timeBlocks.push({
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
    document.getElementById('modal-title').textContent = 'Add Time Block';
    submitBtn.textContent = 'Add';
    editingBlockId = null;
  });

  function removeBlock(blockId) {
    timeBlocks = timeBlocks.filter(b => b.id !== blockId);
    saveTimeBlocks();
    updateDisplay();
  }

  function openModal() {
    modal.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');
  }

  // Event Listeners
  setInterval(() => {
    updateClock();
    updatePrayerCountdown();
    updateCurrentBlocks(); // This will refresh the current block highlighting
  }, 1000);
  
  updateClock();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}`);
          const data = await response.json();
          currentLocation.textContent = `${data.city}, ${data.countryName}`;
          fetchPrayerTimes(latitude, longitude);
        } catch (error) {
          console.error('Error getting location:', error);
          currentLocation.textContent = 'Location unavailable';
        }
      },
      error => {
        console.error('Error getting position:', error);
        currentLocation.textContent = 'Location unavailable';
        fetchPrayerTimes(41.0082, 28.9784); // Istanbul coordinates as fallback
      }
    );
  }

  addBlockBtn.addEventListener('click', openModal);
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission
    closeModal();
  });
  modalOverlay.addEventListener('click', closeModal);

  document.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
      const blockId = parseFloat(e.target.closest('.time-block').dataset.id);
      const block = timeBlocks.find(b => b.id === blockId);
      if (block) {
        block.done = e.target.checked;
        saveTimeBlocks();
        updateDisplay();
      }
    }
  });

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
});