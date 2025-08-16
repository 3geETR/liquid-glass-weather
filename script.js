document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const cityInput = document.getElementById('city-input');
    const weatherContent = document.getElementById('weather-content');
    const hourlyContent = document.getElementById('hourly-content');
    const dailyContent = document.getElementById('daily-content');
    const suggestionsWrapper = document.getElementById('suggestions-wrapper');
    const glassContainers = document.querySelectorAll('.glass-container');

    const defaultCity = 'London';
    let debounceTimer;

    // --- City & Weather Data Fetching ---
    const fetchSuggestions = async (query) => {
        if (query.length < 3) {
            suggestionsWrapper.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=en&format=json`);
            const data = await response.json();
            displaySuggestions(data.results || []);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            suggestionsWrapper.style.display = 'none';
        }
    };

    const fetchWeather = async (city, lat, lon) => {
        weatherContent.innerHTML = `<div id="loading"><p>Loading...</p></div>`;
        suggestionsWrapper.style.display = 'none';
        cityInput.value = '';

        try {
            let latitude = lat;
            let longitude = lon;
            let cityName = city;

            if (!lat || !lon) {
                const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);
                const geoData = await geoResponse.json();
                if (!geoData.results) throw new Error('City not found.');
                latitude = geoData.results[0].latitude;
                longitude = geoData.results[0].longitude;
                cityName = geoData.results[0].name;
            }
            
            const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
            const weatherData = await weatherResponse.json();
            
            displayWeather(weatherData, cityName);
            displayHourlyForecast(weatherData);
            displayDailyForecast(weatherData);
            updateBackground(weatherData.current.weather_code);

        } catch (error) {
            weatherContent.innerHTML = `<div id="error-message"><p>${error.message}</p></div>`;
        }
    };

    // --- Display Logic ---
    const displaySuggestions = (suggestions) => {
        if (suggestions.length === 0) {
            suggestionsWrapper.style.display = 'none';
            return;
        }
        suggestionsWrapper.innerHTML = '';
        suggestions.forEach(city => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `${city.name} <span class="country">${city.admin1 || ''}, ${city.country_code}</span>`;
            item.addEventListener('click', () => {
                fetchWeather(city.name, city.latitude, city.longitude);
            });
            suggestionsWrapper.appendChild(item);
        });
        suggestionsWrapper.style.display = 'block';
    };

    const displayWeather = (data, cityName) => {
        const { temperature_2m, weather_code, relative_humidity_2m, wind_speed_10m } = data.current;
        const { icon, description } = getWeatherInfo(weather_code);

        weatherContent.innerHTML = `
            <div class="weather-main">
                <i class="weather-icon ${icon}"></i>
                <div class="temperature">${Math.round(temperature_2m)}&deg;C</div>
            </div>
            <div class="city-name">${cityName}</div>
            <div class="weather-description">${description}</div>
            <div class="weather-details">
                <div class="detail">
                    <i class="fa-solid fa-water"></i>
                    <span>${relative_humidity_2m}%</span>
                    <span>Humidity</span>
                </div>
                <div class="detail">
                    <i class="fa-solid fa-wind"></i>
                    <span>${wind_speed_10m} km/h</span>
                    <span>Wind</span>
                </div>
            </div>
        `;
    };

    const displayHourlyForecast = (data) => {
        const { time, temperature_2m, weather_code } = data.hourly;
        const now = new Date();
        const currentHour = now.getHours();
        let forecastHtml = '<h2>Hourly Forecast</h2><div class="hourly-forecast">';

        // Find the index of the current hour
        const startIndex = time.findIndex(t => new Date(t).getHours() === currentHour);
        if (startIndex === -1) {
            hourlyContent.innerHTML = '<p>Could not get hourly forecast.</p>';
            return;
        }

        for (let i = startIndex; i < startIndex + 24 && i < time.length; i++) {
            const date = new Date(time[i]);
            const hour = date.getHours();
            const temp = Math.round(temperature_2m[i]);
            const { icon } = getWeatherInfo(weather_code[i]);
            forecastHtml += `
                <div class="hour">
                    <span>${hour}:00</span>
                    <i class="${icon}"></i>
                    <span>${temp}&deg;C</span>
                </div>
            `;
        }
        forecastHtml += '</div>';
        hourlyContent.innerHTML = forecastHtml;
    };

    const displayDailyForecast = (data) => {
        const { time, weather_code, temperature_2m_max, temperature_2m_min } = data.daily;
        let forecastHtml = '<h2>Daily Forecast</h2><div class="daily-forecast">';

        for (let i = 1; i < time.length; i++) {
            const date = new Date(time[i]);
            const day = date.toLocaleDateString('en-US', { weekday: 'short' });
            const maxTemp = Math.round(temperature_2m_max[i]);
            const minTemp = Math.round(temperature_2m_min[i]);
            const { icon } = getWeatherInfo(weather_code[i]);
            forecastHtml += `
                <div class="day">
                    <span>${day}</span>
                    <i class="${icon}"></i>
                    <div class="day-temps">
                        <span>${maxTemp}&deg;</span>
                        <span>${minTemp}&deg;</span>
                    </div>
                </div>
            `;
        }
        forecastHtml += '</div>';
        dailyContent.innerHTML = forecastHtml;
    };


    // --- Mappers and Event Handlers ---
    const getWeatherInfo = (code) => {
        const weatherMap = {
            0: { icon: 'fa-solid fa-sun', description: 'Clear sky' }, 1: { icon: 'fa-solid fa-cloud-sun', description: 'Mainly clear' }, 2: { icon: 'fa-solid fa-cloud', description: 'Partly cloudy' }, 3: { icon: 'fa-solid fa-cloud', description: 'Overcast' }, 45: { icon: 'fa-solid fa-smog', description: 'Fog' }, 48: { icon: 'fa-solid fa-smog', description: 'Depositing rime fog' }, 51: { icon: 'fa-solid fa-cloud-rain', description: 'Light drizzle' }, 53: { icon: 'fa-solid fa-cloud-rain', description: 'Moderate drizzle' }, 55: { icon: 'fa-solid fa-cloud-rain', description: 'Dense drizzle' }, 61: { icon: 'fa-solid fa-cloud-showers-heavy', description: 'Slight rain' }, 63: { icon: 'fa-solid fa-cloud-showers-heavy', description: 'Moderate rain' }, 65: { icon: 'fa-solid fa-cloud-showers-heavy', description: 'Heavy rain' }, 80: { icon: 'fa-solid fa-cloud-showers-heavy', description: 'Slight rain showers' }, 81: { icon: 'fa-solid fa-cloud-showers-heavy', description: 'Moderate rain showers' }, 82: { icon: 'fa-solid fa-cloud-showers-heavy', description: 'Violent rain showers' }, 95: { icon: 'fa-solid fa-cloud-bolt', description: 'Thunderstorm' },
        };
        return weatherMap[code] || { icon: 'fa-solid fa-question', description: 'Unknown' };
    };

    const updateBackground = (code) => {
        let bgImage = 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0'; // Default sunny
        if ([0, 1].includes(code)) bgImage = 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0';
        if ([2, 3].includes(code)) bgImage = 'https://images.unsplash.com/photo-1495312040802-a929cd14a6ab';
        if (code >= 51 && code <= 82) bgImage = 'https://images.unsplash.com/photo-1519692933481-e162a57d6721';
        if (code >= 95) bgImage = 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cf1';
        if ([45, 48].includes(code)) bgImage = 'https://images.unsplash.com/photo-1487621167305-5d248087c883';
        document.body.style.backgroundImage = `url('${bgImage}')`;
    };

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const city = cityInput.value.trim();
        if (city) fetchWeather(city);
    });

    cityInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchSuggestions(cityInput.value.trim());
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!searchForm.contains(e.target)) {
            suggestionsWrapper.style.display = 'none';
        }
    });

    glassContainers.forEach(container => {
        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left; const y = e.clientY - rect.top;
            const rotateX = (y / rect.height - 0.1) * -0.5;
            const rotateY = (x / rect.width - 0.5) * 2;
            container.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });
        container.addEventListener('mouseleave', () => {
            container.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        });
    });

    // --- Initial Load ---
    fetchWeather(defaultCity);
});