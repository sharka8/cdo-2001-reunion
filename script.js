const reunionDate = new Date('2026-10-24T18:00:00-07:00');
const TICKET_PRICE = 45;

const countdownIds = {
  days: document.getElementById('count-days'),
  hours: document.getElementById('count-hours'),
  minutes: document.getElementById('count-minutes'),
  seconds: document.getElementById('count-seconds')
};

function updateCountdown() {
  const distance = reunionDate.getTime() - Date.now();
  if (distance <= 0) {
    countdownIds.days.textContent = '0';
    countdownIds.hours.textContent = '0';
    countdownIds.minutes.textContent = '0';
    countdownIds.seconds.textContent = '0';
    return;
  }

  const day = 1000 * 60 * 60 * 24;
  const hour = 1000 * 60 * 60;
  const minute = 1000 * 60;
  countdownIds.days.textContent = Math.floor(distance / day);
  countdownIds.hours.textContent = String(Math.floor((distance % day) / hour)).padStart(2, '0');
  countdownIds.minutes.textContent = String(Math.floor((distance % hour) / minute)).padStart(2, '0');
  countdownIds.seconds.textContent = String(Math.floor((distance % minute) / 1000)).padStart(2, '0');
}

updateCountdown();
setInterval(updateCountdown, 1000);

const form = document.getElementById('registration-form');
const quantity = document.getElementById('quantity');
const total = document.getElementById('total');
const guestWrap = document.getElementById('guest-names-wrap');
const guestNames = document.getElementById('guestNames');
const message = document.getElementById('form-message');
const submitButton = document.getElementById('submit-button');

function updateTotal() {
  const count = Number(quantity.value);
  total.textContent = `$${count * TICKET_PRICE}`;
  const hasGuests = count > 1;
  guestWrap.classList.toggle('hidden', !hasGuests);
  guestNames.required = hasGuests;
  if (!hasGuests) guestNames.value = '';
}

quantity.addEventListener('change', updateTotal);
updateTotal();

const surveyResponses = document.getElementById('survey-responses');
form.addEventListener('invalid', (event) => {
  const section = event.target.closest('.survey-section');
  if (section) section.open = true;
}, true);
document.getElementById('add-graduate').addEventListener('click', addGraduate);
function addGraduate() {
  if (surveyResponses.children.length >= 6) return;
  const fragment = document.getElementById('survey-template').content.cloneNode(true);
  fragment.querySelector('[data-remove-survey]').addEventListener('click', (event) => {
    event.target.closest('fieldset').remove();
    document.getElementById('add-graduate').disabled = false;
  });
  surveyResponses.append(fragment);
  document.getElementById('add-graduate').disabled = surveyResponses.children.length >= 6;
}
addGraduate();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Preparing checkout…';

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.quantity = Number(payload.quantity);
  payload.concert = formData.get('concert') === 'Yes';
  payload.picnic = formData.get('picnic') === 'Yes';
  payload.cdoVisit = formData.get('cdoVisit') === 'Yes';
  payload.classmateResponses = [...surveyResponses.children].map((fieldset) =>
    Object.fromEntries([...fieldset.querySelectorAll('[data-survey]')].map((input) =>
      [input.dataset.survey, input.type === 'checkbox' ? input.checked : input.value.trim()]
    ))
  );

  try {
    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {};
    }
    if (!response.ok && !data.error) {
      throw new Error('Checkout is temporarily unavailable.');
    }
    if (!response.ok || !data.url) throw new Error(data.error || 'Unable to create checkout.');
    window.location.href = data.url;
  } catch (error) {
    message.textContent = `${error.message} Please try again or email cdo2001reunion@gmail.com.`;
    submitButton.disabled = false;
    submitButton.textContent = 'Continue to secure payment';
  }
});
