document.addEventListener('DOMContentLoaded', () => {
  const currentTime = document.getElementById('current-time');
  const currentLocation = document.getElementById('current-location');
  const prayerBlocks = document.getElementById('prayer-blocks');
  const addBlockBtn = document.getElementById('add-block-btn');
  const modal = document.getElementById('add-block-modal');
  const modalOverlay = document.getElementById('modal-overlay');
  const addBlockForm = document.getElementById('add-block-form');
  const cancelBtn = document.getElementById('cancel-btn');
  const submitBtn = document.getElementById('submit-btn');

  let currentView = 'daily';
  let editingBlockId = null;
  let prayerTimings = {};
  let timeBlocks = loadTimeBlocks();

  // Add countdown element to current-info div
  const currentInfo = document.querySelector('.current-info');
  const countdownDiv = document.createElement('div');
  countdownDiv.className = 'prayer-countdown';
  currentInfo.appendChild(countdownDiv);

  // Initialize view switching
  document.querySelector('.view-switcher')?.addEventListener('click', (e) => {
    if (e.target.matches('button')) {
      document.querySelectorAll('.view-switcher button').forEach(btn => 
        btn.classList.remove('active'));
      e.target.classList.add('active');
      currentView = e.target.dataset.view;
      updateDisplay();
    }
  });

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
    
    // If no next prayer today, use first prayer of next day
    if (!nextPrayer) {
      nextPrayer = prayerTimes[0];
    }

    let minutesUntil = nextPrayer.minutes - currentMinutes;
    if (minutesUntil < 0) {
      minutesUntil += 24 * 60; // Add 24 hours
    }

    const hoursUntil = Math.floor(minutesUntil / 60);
    const minsUntil = minutesUntil % 60;

    countdownDiv.innerHTML = `${nextPrayer.name} in ${hoursUntil}h ${minsUntil}m`;
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
           data-type="${block.type}">
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

    prayers.forEach(prayer => {
      const [hour, minute] = prayer.time.split(':').map(Number);
      const isCurrent = (currentHour === hour && currentMinute >= minute) || 
                       (currentHour > hour && (prayers[prayers.indexOf(prayer) + 1] ? 
                        currentHour < prayers[prayers.indexOf(prayer) + 1].time.split(':')[0] : true));

      const block = document.createElement('div');
      block.className = `prayer-block${isCurrent ? ' current' : ''}`;
      block.innerHTML = `
        <h3>${prayer.name}</h3>
        <div class="prayer-time">${prayer.time}</div>
        <div class="time-blocks" data-prayer="${prayer.name}"></div>
      `;
      prayerBlocks.appendChild(block);
    });

    // Add existing time blocks
    timeBlocks.forEach(block => {
      const container = document.querySelector(`.time-blocks[data-prayer="${block.prayer}"]`);
      if (container) {
        container.insertAdjacentHTML('beforeend', createTimeBlock(block));
      }
    });

    // Add free time blocks
    const freeTimeSlots = calculateFreeTime();
    freeTimeSlots.forEach(slot => {
      const freeBlock = document.createElement('div');
      freeBlock.className = 'free-time-block';
      freeBlock.innerHTML = `
        <div>
          Free Time (${Math.floor(slot.duration / 60)}h ${slot.duration % 60}m)
          <div>${slot.startTime} - ${slot.endTime}</div>
        </div>
      `;

      const container = document.querySelector(`.time-blocks[data-prayer="${slot.prayer}"]`);
      if (container) {
        container.appendChild(freeBlock);
      }
    });
  }

  function updateDisplay() {
    const prayers = Object.entries(prayerTimings).map(([name, time]) => ({
      name,
      time
    }));
    updatePrayerBlocks(prayers);
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
      saveTimeBlocks(); // Add this line here
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
    updateDisplay(); // This will refresh the current block highlighting
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
    }
  });
});