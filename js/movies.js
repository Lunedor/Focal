// --- MOVIES WIDGET WITH TMDB API AND GOAL INTEGRATION ---
window.MovieTracker = (() => {

    // --- CONFIGURATION ---
    const API_CONFIG = {
        tmdb: {
            baseUrl: 'https://api.themoviedb.org/3',
            apiKey: '',
            imageBaseUrl: 'https://image.tmdb.org/t/p/w500'
        }
    };

    // --- MOVIE STATUSES ---
    const MOVIE_STATUSES = {
        'to-watch': { label: 'To Watch', color: 'var(--color-text)', icon: '🎬' },
        'watched': { label: 'Watched', color: 'var(--color-progress-bar)', icon: '✅' },
        'dropped': { label: 'Dropped', color: '#ef4444', icon: '❌' }
    };

    const PAGINATION_CONFIG = {
        moviesPerPage: 10,
        maxVisiblePages: 10,
    };

    // --- STORAGE ---
    const getStorage = window.getStorage || ((key) => localStorage.getItem(key) || '');
    const setStorage = window.setStorage || ((key, value) => localStorage.setItem(key, value));

    // --- STATE ---
    let state = {
        movies: {},
        loading: false,
        error: null,
        currentPage: 1,
        moviesPerPage: PAGINATION_CONFIG.moviesPerPage,
        currentFilter: 'all' // Add filter state
    };

    // --- WIDGET MANAGEMENT ---
    let currentContainer = null;
    let currentConfig = null;

    // --- HELPER FUNCTIONS ---
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function loadMoviesFromStorage() {
        try {
            const stored = getStorage('movies-data');
            if (stored) {
                state.movies = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading movies from storage:', e);
            state.movies = {};
        }
    }

    function saveMoviesToStorage() {
        try {
            setStorage('movies-data', JSON.stringify(state.movies));
        } catch (e) {
            console.error('Error saving movies to storage:', e);
        }
    }

    // --- GOAL INTEGRATION FUNCTIONS ---
    function getWatchingStats() {
        loadMoviesFromStorage();
        const allMovies = Object.entries(state.movies);
        
        const stats = {
            totalMovies: allMovies.length,
            watched: allMovies.filter(([_, movie]) => movie.status === 'watched').length,
            toWatch: allMovies.filter(([_, movie]) => movie.status === 'to-watch').length,
            favorites: allMovies.filter(([_, movie]) => movie.isFavorite).length,
            dropped: allMovies.filter(([_, movie]) => movie.status === 'dropped').length,
            watchedThisYear: 0,
            watchedThisMonth: 0
        };

        // Calculate year/month stats
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        allMovies.forEach(([_, movie]) => {
            if (movie.status === 'watched' && movie.watchedDate) {
                const watchedDate = new Date(movie.watchedDate);
                if (watchedDate.getFullYear() === currentYear) {
                    stats.watchedThisYear++;
                    if (watchedDate.getMonth() === currentMonth) {
                        stats.watchedThisMonth++;
                    }
                }
            }
        });

        return stats;
    }

    function parseCommand(command) {
        const parts = command.split(',').map(p => p.trim());
        const config = { type: parts[0] };
        
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.includes(':')) {
                const [key, value] = part.split(':').map(s => s.trim());
                config[key] = value;
            }
        }
        
        return config;
    }

    // --- TMDB API ---
    async function searchMovies(query) {
        if (!query.trim()) return [];
        
        try {
            const response = await fetch(
                `${API_CONFIG.tmdb.baseUrl}/search/movie?api_key=${await getTmdbApiKey()}&query=${encodeURIComponent(query)}`
            );
            
            if (!response.ok) {
                throw new Error(`TMDB API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error('Error searching movies:', error);
            return [];
        }
    }

    async function getMovieDetails(movieId) {
        try {
            const response = await fetch(
                `${API_CONFIG.tmdb.baseUrl}/movie/${movieId}?api_key=${API_CONFIG.tmdb.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error(`TMDB API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching movie details:', error);
            return null;
        }
    }

    function formatTmdbMovieData(tmdbMovie) {
        return {
            id: tmdbMovie.id.toString(),
            title: tmdbMovie.title,
            releaseDate: tmdbMovie.release_date,
            poster: tmdbMovie.poster_path ? `${API_CONFIG.tmdb.imageBaseUrl}${tmdbMovie.poster_path}` : null,
            overview: tmdbMovie.overview,
            rating: tmdbMovie.vote_average,
            genres: tmdbMovie.genres ? tmdbMovie.genres.map(g => g.name).join(', ') : '',
            runtime: tmdbMovie.runtime,
            status: 'to-watch',
            isFavorite: false,
            addedDate: new Date().toISOString(), // Use full timestamp instead of just date
            personalRating: null,
            watchedDate: null
        };
    }

    // --- PAGINATION FUNCTIONS ---
    function paginateMovies(movies, page = 1, perPage = PAGINATION_CONFIG.moviesPerPage) {
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedMovies = movies.slice(startIndex, endIndex);
        
        return {
            movies: paginatedMovies,
            currentPage: page,
            totalPages: Math.ceil(movies.length / perPage),
            totalMovies: movies.length,
            hasNextPage: endIndex < movies.length,
            hasPrevPage: page > 1
        };
    }

    function renderPagination(pagination, widgetClass = 'full-tracker') {
        if (pagination.totalPages <= 1) return '';
        
        let paginationHtml = `<div class="movie-pagination">`;
        
        // Previous button
        if (pagination.hasPrevPage) {
            paginationHtml += `<button class="pagination-btn" data-page="${pagination.currentPage - 1}">←</button>`;
        }
        
        // Page numbers
        const startPage = Math.max(1, pagination.currentPage - 2);
        const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === pagination.currentPage ? 'active' : '';
            paginationHtml += `<button class="pagination-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }
        
        // Next button
        if (pagination.hasNextPage) {
            paginationHtml += `<button class="pagination-btn" data-page="${pagination.currentPage + 1}">→</button>`;
        }
        
        paginationHtml += `</div>`;
        return paginationHtml;
    }

    // --- WIDGET RENDERING ---
    function renderFullTracker(state) {
        const allMovies = Object.entries(state.movies)
            .sort(([_, a], [__, b]) => new Date(b.addedDate) - new Date(a.addedDate));
        
        // Apply current filter
        let filteredMovies = allMovies;
        if (state.currentFilter === 'to-watch' || state.currentFilter === 'watched' || state.currentFilter === 'dropped') {
            filteredMovies = allMovies.filter(([_, movie]) => movie.status === state.currentFilter);
        } else if (state.currentFilter === 'favorites') {
            filteredMovies = allMovies.filter(([_, movie]) => movie.isFavorite);
        }
        
        const pagination = paginateMovies(filteredMovies, state.currentPage);
        
        return `
            <div class="movie-tracker full-tracker">
                <div class="movie-header">
                    <h3>🎬 Movies</h3>
                    <button class="movie-add-btn">Add Movie</button>
                </div>
                <div class="movie-search" style="display: none;">
                    <input type="text" placeholder="Search movies..." class="movie-search-input">
                    <div class="movie-search-results"></div>
                </div>
                <div class="movie-filters">
                    <button class="filter-btn ${state.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${allMovies.length})</button>
                    <button class="filter-btn ${state.currentFilter === 'to-watch' ? 'active' : ''}" data-filter="to-watch">To Watch (${allMovies.filter(([_, m]) => m.status === 'to-watch').length})</button>
                    <button class="filter-btn ${state.currentFilter === 'watched' ? 'active' : ''}" data-filter="watched">Watched (${allMovies.filter(([_, m]) => m.status === 'watched').length})</button>
                    <button class="filter-btn ${state.currentFilter === 'favorites' ? 'active' : ''}" data-filter="favorites">Favorites (${allMovies.filter(([_, m]) => m.isFavorite).length})</button>
                </div>
                <div class="movie-list">
                    ${renderMoviesList(pagination.movies)}
                </div>
                ${renderPagination(pagination)}
            </div>
        `;
    }

    function renderMovieItem(movieId, movieData) {
        const statusConfig = MOVIE_STATUSES[movieData.status] || MOVIE_STATUSES['to-watch'];
        const releaseYear = movieData.releaseDate ? new Date(movieData.releaseDate).getFullYear() : '';
        const watchedDate = movieData.watchedDate ? new Date(movieData.watchedDate).toLocaleDateString() : '';
        const personalRating = movieData.personalRating ? '★'.repeat(movieData.personalRating) + '☆'.repeat(5 - movieData.personalRating) : '';
        
        return `
            <div class="movie-item" data-movie-id="${movieId}">
            <div class="movie-poster">
                ${movieData.poster ? 
                `<img src="${movieData.poster}" alt="${escapeHtml(movieData.title)}" loading="lazy">` :
                `<div class="movie-poster-placeholder">🎬</div>`
                }
            </div>
            <div class="movie-info">
                <div class="movie-title">${escapeHtml(movieData.title)} ${releaseYear ? `(${releaseYear})` : ''}
                <button class="movie-favorite-btn" data-movie-id="${movieId}" title="Toggle Favorite" style="background:none;border:none;cursor:pointer;font-size:1.2em;vertical-align:middle;">${movieData.isFavorite ? '❤️' : '🤍'}</button>
                </div>
                <div class="movie-meta">
                <span class="movie-status" style="color: ${statusConfig.color}">
                    ${statusConfig.icon} ${statusConfig.label}
                </span>
                ${movieData.runtime ? `<span class="movie-runtime">${movieData.runtime}min</span>` : ''}
                ${movieData.rating ? `<span class="movie-tmdb-rating">⭐ ${movieData.rating.toFixed(1)}</span>` : ''}
                </div>
                ${movieData.personalRating ? `<div class="movie-personal-rating">${'★'.repeat(movieData.personalRating) + '☆'.repeat(5 - movieData.personalRating)}</div>` : ''}
                ${watchedDate ? `<div class="movie-watched-date">Watched: ${watchedDate}</div>` : ''}
            </div>
            <div class="movie-actions">
                <select class="movie-status-select" data-movie-id="${movieId}">
                ${Object.entries(MOVIE_STATUSES).map(([status, config]) => 
                    `<option value="${status}" ${movieData.status === status ? 'selected' : ''}>${config.label}</option>`
                ).join('')}
                </select>
                <button class="movie-edit-btn" data-movie-id="${movieId}">Edit</button>
                <button class="movie-remove-btn" data-movie-id="${movieId}">×</button>
            </div>
            </div>
        `;
    }

    async function getTmdbApiKey() {
      if (API_CONFIG.tmdb.apiKey) {
        return API_CONFIG.tmdb.apiKey; // Return cached key if available
      } else {
        const response = await fetch('https://tesla.x10.mx/api_keys.php');
        const data = await response.json();
        API_CONFIG.tmdb.apiKey = data.tmdb_api_key; // Cache the key
        return API_CONFIG.tmdb.apiKey;
      }
    }

    function renderMoviesList(movies) {
        if (movies.length === 0) {
            return '<div class="movie-empty">No movies found. Add some movies to get started!</div>';
        }
        
        return movies.map(([movieId, movieData]) => renderMovieItem(movieId, movieData)).join('');
    }

    function renderWatchlistWidget(state) {
        const toWatchMovies = Object.entries(state.movies)
            .filter(([_, movie]) => movie.status === 'to-watch')
            .sort(([_, a], [__, b]) => new Date(b.addedDate) - new Date(a.addedDate));
        const pagination = paginateMovies(toWatchMovies, state.currentPage, 10);
        
        return `
            <div class="movie-tracker watchlist">
                <div class="movie-header">
                    <div class="movie-header">
                    <h4>Watchlist</h4>
                    <span class="movie-count">${toWatchMovies.length}</span>
                </div>
                    <button class="movie-add-btn">Add Movie</button>
                </div>
                <div class="movie-search" style="display: none;">
                    <input type="text" placeholder="Search movies..." class="movie-search-input">
                    <div class="movie-search-results"></div>
                </div>
                <div class="movie-simple-list">
                    ${pagination.movies.length === 0 ? 
                        '<div class="movie-empty">No movies in watchlist</div>' :
                        pagination.movies.map(([movieId, movie]) => `
                            <div class="movie-simple-item" data-movie-id="${movieId}">
                                <input type="checkbox" class="movie-checkbox" data-movie-id="${movieId}" ${movie.status === 'watched' ? 'checked' : ''}>
                                <div class="movie-info-simple">
                                    <span class="movie-title">${escapeHtml(movie.title)}</span>
                                    <span class="movie-year">${movie.releaseDate ? `(${new Date(movie.releaseDate).getFullYear()})` : ''}</span>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
                ${renderPagination(pagination, 'watchlist')}
            </div>
        `;
    }

    function renderWatchedWidget(state) {
        const watchedMovies = Object.entries(state.movies)
            .filter(([_, movie]) => movie.status === 'watched')
            .sort(([_, a], [__, b]) => new Date(b.addedDate) - new Date(a.addedDate));
        const pagination = paginateMovies(watchedMovies, state.currentPage, 10);
        
        return `
            <div class="movie-tracker watched">
                <div class="movie-header">
                    <h4>Recently Watched</h4>
                    <span class="movie-count">${watchedMovies.length}</span>
                </div>
                <div class="movie-simple-list">
                    ${pagination.movies.length === 0 ? 
                        '<div class="movie-empty">No watched movies</div>' :
                        pagination.movies.map(([movieId, movie]) => `
                            <div class="movie-simple-item" data-movie-id="${movieId}">
                                <span class="movie-title">${escapeHtml(movie.title)}</span>
                                <span class="movie-rating">${movie.personalRating ? '★'.repeat(movie.personalRating) : ''}</span>
                            </div>
                        `).join('')
                    }
                </div>
                ${renderPagination(pagination, 'watched')}
            </div>
        `;
    }

    function renderFavoritesWidget(state) {
        const favoriteMovies = Object.entries(state.movies)
            .filter(([_, movie]) => movie.isFavorite)
            .sort(([_, a], [__, b]) => new Date(b.addedDate) - new Date(a.addedDate));
        const pagination = paginateMovies(favoriteMovies, state.currentPage, 10);
        
        return `
            <div class="movie-tracker favorites">
                <div class="movie-header">
                    <h4>Favorites</h4>
                    <span class="movie-count">${favoriteMovies.length}</span>
                </div>
                <div class="movie-simple-list">
                    ${pagination.movies.length === 0 ? 
                        '<div class="movie-empty">No favorite movies</div>' :
                        pagination.movies.map(([movieId, movie]) => `
                            <div class="movie-simple-item" data-movie-id="${movieId}">
                                <span class="movie-title">${escapeHtml(movie.title)}</span>
                                <span class="movie-year">${movie.releaseDate ? `(${new Date(movie.releaseDate).getFullYear()})` : ''}</span>
                            </div>
                        `).join('')
                    }
                </div>
                ${renderPagination(pagination, 'favorites')}
            </div>
        `;
    }

    function renderStatsWidget(state) {
        const stats = getWatchingStats();
        
        return `
            <div class="movie-tracker stats">
                <div class="movie-header">
                    <h4>Movie Stats</h4>
                </div>
                <div class="movie-stats-grid">
                    <div class="stat-item">
                        <span class="stat-number">${stats.watched}</span>
                        <span class="stat-label">Watched</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${stats.toWatch}</span>
                        <span class="stat-label">To Watch</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${stats.watchedThisYear}</span>
                        <span class="stat-label">This Year</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${stats.watchedThisMonth}</span>
                        <span class="stat-label">This Month</span>
                    </div>
                </div>
            </div>
        `;
    }

    // --- EVENT HANDLERS ---
    function setupEventListeners(container) {
        if (!container) return;

        // Add movie button - individual listener like books widget
        const addBtn = container.querySelector('.movie-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const searchDiv = container.querySelector('.movie-search');
                if (searchDiv) {
                    searchDiv.style.display = searchDiv.style.display === 'none' ? 'block' : 'none';
                    if (searchDiv.style.display === 'block') {
                        const searchInput = searchDiv.querySelector('.movie-search-input');
                        if (searchInput) searchInput.focus();
                    }
                }
            });
        }

        // Movie status changes - individual listeners like books widget
        container.querySelectorAll('.movie-status-select').forEach(select => {
            select.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            select.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const movieId = e.target.dataset.movieId;
                const newStatus = e.target.value;
                updateMovieStatus(movieId, newStatus);
            });
        });

        // Movie removal - individual listeners like books widget
        container.querySelectorAll('.movie-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const movieId = e.target.dataset.movieId;
                removeMovie(movieId);
            });
        });

        // Movie edit buttons - individual listeners
        container.querySelectorAll('.movie-edit-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const movieId = e.target.dataset.movieId;
                const movie = state.movies[movieId];
                if (!movie) return;

                // Show edit modal for movie details
                const rating = await showModal(
                    `Edit "${movie.title}"`, 
                    'Enter rating (1-5 stars, or leave empty to remove)', 
                    movie.personalRating || ''
                );
                
                // If rating is null, it could be either cancelled or empty submission
                // We need to distinguish between them
                if (rating === null) {
                    // For empty submission (removing rating), we need to check if the current rating exists
                    // If there's a current rating, assume empty submission means remove it
                    if (movie.personalRating) {
                        // Remove rating completely
                        loadMoviesFromStorage();
                        if (state.movies[movieId]) {
                            delete state.movies[movieId].personalRating;
                            saveMoviesToStorage();
                            // Re-render the entire app to show the updated widget
                            if (typeof renderApp === 'function') {
                                renderApp();
                            } else if (currentContainer) {
                                render(currentContainer, currentConfig);
                            }
                        }
                    }
                    // If no current rating, treat as cancel - do nothing
                } else {
                    // Rating is not null, so user entered something
                    const ratingNum = parseInt(rating);
                    if (ratingNum >= 1 && ratingNum <= 5) {
                        updateMovieField(movieId, 'personalRating', ratingNum);
                    } else {
                        alert('Please enter a rating between 1 and 5, or leave empty to remove rating');
                    }
                }
            });
        });

        // Filter buttons - individual listeners
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const filter = e.target.dataset.filter;
                filterMovies(filter);
            });
        });

        // Favorite star button listeners
        container.querySelectorAll('.movie-favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const movieId = e.target.dataset.movieId;
                toggleFavorite(movieId);
            });
        });

            // Movie details modal: name and poster click
            container.querySelectorAll('.movie-title, .movie-poster img, .movie-poster-placeholder').forEach(el => {
                el.style.cursor = 'pointer';
                el.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Find movieId from parent .movie-item or .movie-simple-item
                    let movieItem = e.target.closest('.movie-item, .movie-simple-item');
                    if (!movieItem) return;
                    const movieId = movieItem.dataset.movieId;
                    if (!movieId || !state.movies[movieId]) return;
                    showMovieDetailsModal(state.movies[movieId]);
                });
            });
    // --- FAVORITE TOGGLE ---
    function toggleFavorite(movieId) {
        loadMoviesFromStorage();
        if (!state.movies[movieId]) return;
        state.movies[movieId].isFavorite = !state.movies[movieId].isFavorite;
        saveMoviesToStorage();
        if (typeof renderApp === 'function') {
            renderApp();
        } else if (currentContainer) {
            render(currentContainer, currentConfig);
        }
    }

        // Pagination buttons - individual listeners
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const page = parseInt(e.target.dataset.page);
                if (page && page !== state.currentPage) {
                    state.currentPage = page;
                    
                    // Re-render the entire app to show the updated page
                    if (typeof renderApp === 'function') {
                        renderApp();
                    } else if (currentContainer) {
                        render(currentContainer, currentConfig);
                    }
                }
            });
        });

        // Movie watchlist checkboxes - using books widget pattern
        container.querySelectorAll('.movie-checkbox').forEach(checkbox => {
            // Remove any existing listeners first
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);

            // Add event listeners to the fresh checkbox
            newCheckbox.addEventListener('change', (e) => {
                e.stopPropagation(); // Prevent event bubbling

                const movieId = e.target.dataset.movieId;
                const isChecked = e.target.checked;

                // Update movie status based on checkbox state
                if (isChecked) {
                    updateMovieStatus(movieId, 'watched');
                } else {
                    updateMovieStatus(movieId, 'to-watch');
                }

                // Force immediate re-render to ensure UI updates
                setTimeout(() => {
                    renderApp();
                }, 10);
            });

            // Prevent edit mode when clicking on checkbox area
            newCheckbox.addEventListener('click', (e) => {
                e.stopPropagation(); // Just prevent bubbling, allow normal checkbox behavior
            });
        });

        // Movie search
        const searchInput = container.querySelector('.movie-search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    const query = e.target.value.trim();
                    const resultsDiv = container.querySelector('.movie-search-results');
                    if (!resultsDiv) return;

                    if (query.length < 2) {
                        resultsDiv.innerHTML = '';
                        return;
                    }

                    resultsDiv.innerHTML = '<div class="search-loading">Searching...</div>';
                    
                    try {
                        const movies = await searchMovies(query);
                        if (movies.length === 0) {
                            resultsDiv.innerHTML = '<div class="search-no-results">No movies found</div>';
                            return;
                        }

                        resultsDiv.innerHTML = movies.slice(0, 5).map(movie => `
                            <div class="search-result-item" data-movie-id="${movie.id}">
                                <div class="search-result-poster">
                                    ${movie.poster_path ? 
                                        `<img src="${API_CONFIG.tmdb.imageBaseUrl}${movie.poster_path}" alt="${escapeHtml(movie.title)}">` : 
                                        '🎬'
                                    }
                                </div>
                                <div class="search-result-info">
                                    <div class="search-result-title">${escapeHtml(movie.title)}</div>
                                    <div class="search-result-year">${movie.release_date ? new Date(movie.release_date).getFullYear() : ''}</div>
                                    <div class="search-result-overview">${escapeHtml(movie.overview?.substring(0, 100) || '')}${movie.overview?.length > 100 ? '...' : ''}</div>
                                </div>
                                <button class="search-result-add" data-movie-id="${movie.id}">Add</button>
                            </div>
                        `).join('');

                        // Add listeners to the new add buttons
                        resultsDiv.querySelectorAll('.search-result-add').forEach(addBtn => {
                            addBtn.addEventListener('click', async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const movieId = e.target.dataset.movieId;
                                const movieDetails = await getMovieDetails(movieId);
                                if (movieDetails) {
                                    const movieData = formatTmdbMovieData(movieDetails);
                                    addMovie(movieId, movieData);
                                    
                                    // Hide search and clear input
                                    const searchDiv = container.querySelector('.movie-search');
                                    const searchInput = container.querySelector('.movie-search-input');
                                    const searchResults = container.querySelector('.movie-search-results');
                                    if (searchDiv) searchDiv.style.display = 'none';
                                    if (searchInput) searchInput.value = '';
                                    if (searchResults) searchResults.innerHTML = '';
                                }
                            });
                        });
                    } catch (error) {
                        resultsDiv.innerHTML = '<div class="search-error">Error searching movies</div>';
                    }
                }, 300);
            });
        
        }

        // --- MOVIE DETAILS MODAL LOGIC ---
        function showMovieDetailsModal(movie) {
                        let modal = document.getElementById('movie-details-modal');
                        let titleEl = document.getElementById('movie-details-title');
                        let bodyEl = document.getElementById('movie-details-body');
                        if (!modal) {
                                // Fallback: inject modal HTML if missing
                                const modalHtml = `
                                <div id="movie-details-modal" class="modal-overlay">
                                    <div class="modal movie-details-modal">
                                        <div class="modal-header">
                                            <h3 id="movie-details-title"></h3>
                                            <button id="movie-details-close" class="modal-close">×</button>
                                        </div>
                                        <div class="modal-body" id="movie-details-body"></div>
                                    </div>
                                </div>`;
                                document.body.insertAdjacentHTML('beforeend', modalHtml);
                                modal = document.getElementById('movie-details-modal');
                                titleEl = document.getElementById('movie-details-title');
                                bodyEl = document.getElementById('movie-details-body');
                        }
                        if (!modal || !titleEl || !bodyEl) {
                                alert('Movie modal could not be found or created.');
                                return;
                        }
                        console.log('[Movie Modal] Opening for:', movie.title);

            // Fill modal content with status dropdown
                titleEl.textContent = `${movie.title}${movie.releaseDate ? ' (' + new Date(movie.releaseDate).getFullYear() + ')' : ''}`;
                bodyEl.innerHTML = `
                    <div class="movie-details-content">
                        <div class='movie-details-header'>
                        ${movie.poster ? `<img src='${movie.poster}' alt='${escapeHtml(movie.title)}' class='movie-details-poster'>` : ''}
                        <div class='movie-details-meta'>
                            <div class='movie-details-status'>
                                <label for="modal-movie-status-select"><strong>Status:</strong></label>
                                <select id="modal-movie-status-select" class="movie-status-select">
                                    ${Object.entries(MOVIE_STATUSES).map(([status, config]) => 
                                        `<option value="${status}" ${movie.status === status ? 'selected' : ''}>${config.label}</option>`
                                    ).join('')}
                                </select>
                                <button class="movie-favorite-btn" data-movie-id="${movie.id}" title="Toggle Favorite" style="background:none;border:none;cursor:pointer;font-size:1.3em;vertical-align:middle;">${movie.isFavorite ? '❤️' : '🤍'}</button>
                            </div>
                            <div><strong>Rating:</strong> ${movie.rating ? '⭐ ' + movie.rating.toFixed(1) : 'N/A'}</div>
                            <div><strong>Genres:</strong> ${movie.genres || 'N/A'}</div>
                            <div><strong>Runtime:</strong> ${movie.runtime ? movie.runtime + ' min' : 'N/A'}</div>
                            <div><strong>Watched Date:</strong> ${movie.watchedDate ? new Date(movie.watchedDate).toLocaleDateString() : 'N/A'}</div>
                            <div><strong>Personal Rating:</strong> ${movie.personalRating ? '★'.repeat(movie.personalRating) + '☆'.repeat(5 - movie.personalRating) : 'N/A'}</div>                            
                        </div>
                        </div>
                        <div class='movie-details-overview'><strong>Overview:</strong><br>${escapeHtml(movie.overview || '')}</div>
                    </div>
                `;
            // Status change event
            const statusSelect = bodyEl.querySelector('#modal-movie-status-select');
            if (statusSelect) {
                statusSelect.addEventListener('change', (e) => {
                    updateMovieStatus(movie.id, e.target.value);
                    // Do not close modal
                });
            }
            // Favorite button event
            const favBtn = bodyEl.querySelector('.movie-favorite-btn');
            if (favBtn) {
                favBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(movie.id);
                    // Update the icon immediately in the modal
                    // Get the latest favorite state from storage
                    loadMoviesFromStorage();
                    const isFav = state.movies[movie.id] && state.movies[movie.id].isFavorite;
                    favBtn.innerHTML = isFav ? '❤️' : '🤍';
                });
            }
            modal.classList.remove('hidden');

            // Close logic
            const closeBtn = document.getElementById('movie-details-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    modal.classList.add('hidden');
                };
            }
            // Also close on overlay click
            modal.onclick = (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            };
            }
    }

    // --- MOVIE MANAGEMENT ---
    function addMovie(movieId, movieData, status = 'to-watch') {
        loadMoviesFromStorage();
        
        if (state.movies[movieId]) {
            
            return;
        }
        
        state.movies[movieId] = { ...movieData, status };
        saveMoviesToStorage();
        
        // Re-render the entire app to show the updated widget
        if (typeof renderApp === 'function') {
            renderApp();
        } else if (currentContainer) {
            render(currentContainer, currentConfig);
        }
    }

    function updateMovieStatus(movieId, newStatus) {
        loadMoviesFromStorage();
        
        if (!state.movies[movieId]) return;
        
        state.movies[movieId].status = newStatus;
        
        // Set watched date if moving to watched
        if (newStatus === 'watched' && !state.movies[movieId].watchedDate) {
            state.movies[movieId].watchedDate = new Date().toISOString().split('T')[0];
        }
        
        // Update addedDate to current date so it appears at the top
        state.movies[movieId].addedDate = new Date().toISOString(); // Use full timestamp instead of just date
        
        saveMoviesToStorage();
        
        // Re-render the entire app to show the updated widget
        if (typeof renderApp === 'function') {
            renderApp();
        } else if (currentContainer) {
            render(currentContainer, currentConfig);
        }
    }

    function updateMovieRating(movieId, rating) {
        loadMoviesFromStorage();
        
        if (!state.movies[movieId]) return;
        
        state.movies[movieId].personalRating = rating;
        saveMoviesToStorage();
        
        // Re-render the entire app to show the updated widget
        if (typeof renderApp === 'function') {
            renderApp();
        } else if (currentContainer) {
            render(currentContainer, currentConfig);
        }
    }

    function updateMovieField(movieId, field, value) {
        loadMoviesFromStorage();
        
        if (!state.movies[movieId]) return;
        
        state.movies[movieId][field] = value;
        
        // Update addedDate to current date so it appears at the top when edited
        state.movies[movieId].addedDate = new Date().toISOString(); // Use full timestamp instead of just date
        
        saveMoviesToStorage();
        
        // Re-render the entire app to show the updated widget
        if (typeof renderApp === 'function') {
            renderApp();
        } else if (currentContainer) {
            render(currentContainer, currentConfig);
        }
    }

    function removeMovie(movieId) {
        loadMoviesFromStorage();
        
        if (!state.movies[movieId]) return;
        
        const movieTitle = state.movies[movieId].title || movieId.replace(/-/g, ' ');
        const message = `Are you sure you want to remove "<strong>${movieTitle}</strong>" from your movie list?<br><br>This action cannot be undone.`;

        // Use the existing modal confirmation system like books widget
        showConfirm(message).then((confirmed) => {
            if (confirmed) {
                delete state.movies[movieId];
                saveMoviesToStorage();
                
                // Re-render the entire app to show the updated widget
                if (typeof renderApp === 'function') {
                    renderApp();
                } else if (currentContainer) {
                    render(currentContainer, currentConfig);
                }
            }
        });
    }

    function filterMovies(filter) {
        // Update the filter state
        state.currentFilter = filter;
        state.currentPage = 1; // Reset to first page when filtering
        
        // Re-render the entire app to show the filtered results
        if (typeof renderApp === 'function') {
            renderApp();
        } else if (currentContainer) {
            render(currentContainer, currentConfig);
        }
    }

    function render(container, config) {
        if (!container) return;
        
        currentContainer = container;
        currentConfig = config;
        
        loadMoviesFromStorage();
        
        const parsedConfig = parseCommand(config);
        let html = '';
        
        switch (parsedConfig.type) {
            case 'watchlist':
                html = renderWatchlistWidget(state);
                break;
            case 'watched':
                html = renderWatchedWidget(state);
                break;
            case 'favorites':
                html = renderFavoritesWidget(state);
                break;
            case 'stats':
                html = renderStatsWidget(state);
                break;
            default:
                html = renderFullTracker(state);
                break;
        }
        
        container.innerHTML = html;
        setupEventListeners(container);
    }

    // --- INIT FUNCTION (Required by widgetRegistry) ---
    function init(options) {
        const { placeholder, config, onCommandChange } = options;
        
        // Store the command change callback
        if (onCommandChange) {
            // You can use this for dynamic command updates if needed
        }
        
        render(placeholder, config);
    }

    function getToDoCount() {
        loadMoviesFromStorage();
        return Object.values(state.movies).filter(movie => movie.status === 'to-watch').length;
    }

    // This function is for getting the goal progress.
    function getFinishedCount({ startDate, endDate }) {
        loadMoviesFromStorage();
        return Object.values(state.movies).filter(movie => {
            if (movie.status !== 'watched' || !movie.watchedDate) return false;
            const watchedDate = new Date(movie.watchedDate);
            return watchedDate >= startDate && watchedDate <= endDate;
        }).length;
    }

    // --- PUBLIC API ---
    return {
        init,
        render,
        addMovie,
        updateMovieStatus,
        updateMovieRating,
        updateMovieField,
        removeMovie,
        searchMovies,
        getMovieDetails,
        getWatchingStats,
        getToDoCount,
        getFinishedCount,
        getTmdbApiKey
    };
})();
