const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const CITY = 'Chennai';
const COUNTRY = 'IN';

async function getCurrentWeather() {
  if (!WEATHER_API_KEY) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY},${COUNTRY}&units=metric&appid=${WEATHER_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const high = Math.round(data.main.temp_max);
    const low = Math.round(data.main.temp_min);
    const humidity = data.main.humidity;
    const description = data.weather[0]?.description || '';
    const icon = weatherEmoji(data.weather[0]?.main || '');

    return {
      temp,
      feelsLike,
      high,
      low,
      humidity,
      description,
      icon,
      summary: `${icon} ${temp}° (feels ${feelsLike}°), ${description}. High ${high}°, low ${low}°. Humidity ${humidity}%.`,
    };
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return null;
  }
}

function weatherEmoji(main) {
  const map = {
    Clear: '☀️', Clouds: '☁️', Rain: '🌧️', Drizzle: '🌦️',
    Thunderstorm: '⛈️', Snow: '❄️', Mist: '🌫️', Haze: '🌫️',
    Fog: '🌫️', Smoke: '🌫️',
  };
  return map[main] || '🌤️';
}

module.exports = { getCurrentWeather };
