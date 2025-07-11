// --- BOOKS WIDGET WITH GOOGLE BOOKS API AND GOAL INTEGRATION ---
window.BookTracker = (() => {

    // --- CONFIGURATION ---
    const API_CONFIG = {
        googleBooks: {
            baseUrl: 'https://www.googleapis.com/books/v1',
            // No API key needed for basic search
        }
    };

    // --- BOOK STATUSES ---
    const BOOK_STATUSES = {
        'to-read': { label: 'To Read', color: '#6B7280', icon: '📚' },
        'reading': { label: 'Reading', color: '#3B82F6', icon: '📖' },
        'finished': { label: 'Finished', color: '#10B981', icon: '✅' },
        'dnf': { label: 'DNF', color: '#EF4444', icon: '❌' },
        'on-hold': { label: 'On Hold', color: '#F59E0B', icon: '⏸️' }
    };

    const PAGINATION_CONFIG = {
        booksPerPage: 8,  // Show 8 books per page
        maxVisiblePages: 10,  // Show max 10 page numbers
    };

    // --- STORAGE ---
    const getStorage = window.getStorage || ((key) => localStorage.getItem(key) || '');
    const setStorage = window.setStorage || ((key, value) => localStorage.setItem(key, value));

    // --- STATE ---
    let state = {
        books: {},
        loading: false,
        error: null,
        currentPage: 1,
        booksPerPage: PAGINATION_CONFIG.booksPerPage
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

    function loadBooksFromStorage() {
        try {
            const stored = getStorage('books-data');
            if (stored) {
                state.books = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading books from storage:', e);
        }
    }

    function saveBooksToStorage() {
        try {
            setStorage('books-data', JSON.stringify(state.books));
            // Trigger sync if available
            if (typeof window.debouncedSyncWithCloud === 'function') {
                window.debouncedSyncWithCloud();
            }
        } catch (e) {
            console.error('Error saving books to storage:', e);
        }
    }

    // --- GOAL INTEGRATION FUNCTIONS ---
    function getReadingStats() {
        loadBooksFromStorage(); // Ensure we have the latest data
        const allBooks = Object.entries(state.books);
        return {
            total: allBooks.length,
            toRead: allBooks.filter(([_, data]) => data.status === 'to-read').length,
            reading: allBooks.filter(([_, data]) => data.status === 'reading').length,
            finished: allBooks.filter(([_, data]) => data.status === 'finished').length,
            dnf: allBooks.filter(([_, data]) => data.status === 'dnf').length,
            onHold: allBooks.filter(([_, data]) => data.status === 'on-hold').length
        };
    }

    function parseCommand(command) {
        const parts = command.split(',').map(p => p.trim());
        const widgetType = parts[0]?.replace('BOOKS:', '').trim() || 'full-tracker';

        let books = [];
        let error = null;

        try {
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                if (part) {
                    if (part.includes(':')) {
                        const [bookId, status] = part.split(':').map(p => p.trim());
                        books.push({ bookId, status });
                    } else {
                        books.push({ bookId: part, status: 'to-read' });
                    }
                }
            }
        } catch (e) {
            error = `Error parsing book data: ${e.message}`;
        }

        return { widgetType, books, error };
    }

    // --- GOOGLE BOOKS API ---
    async function searchBooks(query) {
        try {
            const response = await fetch(`${API_CONFIG.googleBooks.baseUrl}/volumes?q=${encodeURIComponent(query)}&maxResults=10`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error('Error searching books:', error);
            return [];
        }
    }

    async function getBookDetails(bookId) {
        try {
            // Check if it's a Google Books ID or a custom identifier
            if (bookId.includes('gbooks_')) {
                const googleBooksId = bookId.replace('gbooks_', '');
                const response = await fetch(`${API_CONFIG.googleBooks.baseUrl}/volumes/${googleBooksId}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                return formatGoogleBookData(data);
            } else {
                // Return mock data for custom book IDs
                return {
                    id: bookId,
                    title: bookId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    author: 'Unknown Author',
                    cover: `https://placehold.co/150x200/e5e7eb/6b7280?text=${encodeURIComponent(bookId)}`,
                    publishedDate: new Date().getFullYear(),
                    description: 'A great book to read.'
                };
            }
        } catch (error) {
            console.error('Error fetching book details:', error);
            return {
                id: bookId,
                title: bookId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                author: 'Unknown Author',
                cover: `https://placehold.co/150x200/e5e7eb/6b7280?text=${encodeURIComponent(bookId)}`,
                publishedDate: new Date().getFullYear(),
                description: 'Error loading book details.'
            };
        }
    }

    function formatGoogleBookData(googleBook) {
        const volumeInfo = googleBook.volumeInfo || {};
        const imageLinks = volumeInfo.imageLinks || {};

        return {
            id: `gbooks_${googleBook.id}`,
            title: volumeInfo.title || 'Unknown Title',
            author: volumeInfo.authors ? volumeInfo.authors.join(', ') : 'Unknown Author',
            cover: imageLinks.thumbnail || imageLinks.smallThumbnail || `https://placehold.co/150x200/e5e7eb/6b7280?text=${encodeURIComponent(volumeInfo.title || 'Book')}`,
            publishedDate: volumeInfo.publishedDate || 'Unknown',
            description: volumeInfo.description || 'No description available.',
            pageCount: volumeInfo.pageCount || 0,
            categories: volumeInfo.categories || [],
            language: volumeInfo.language || 'en'
        };
    }

    // --- PAGINATION FUNCTIONS ---
    function paginateBooks(books, page = 1, perPage = PAGINATION_CONFIG.booksPerPage) {
    // Sort books by dateAdded descending (newest first)
    const bookEntries = Object.entries(books).sort((a, b) => {
        const dateA = new Date(a[1].dateAdded || 0);
        const dateB = new Date(b[1].dateAdded || 0);
        return dateB - dateA;
    });
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedBooks = bookEntries.slice(startIndex, endIndex);
        
        return {
            books: Object.fromEntries(paginatedBooks),
            totalBooks: bookEntries.length,
            totalPages: Math.ceil(bookEntries.length / perPage),
            currentPage: page,
            hasNextPage: endIndex < bookEntries.length,
            hasPrevPage: page > 1
        };
    }

    function renderPagination(pagination, widgetClass = 'full-tracker') {
        if (pagination.totalPages <= 1) return '';
        
        const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;
        
        // Calculate visible page range
        const maxVisible = PAGINATION_CONFIG.maxVisiblePages;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        const pages = [];
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        
        return `
            <div class="books-pagination">
                <button class="pagination-btn" data-page="${currentPage - 1}" ${!hasPrevPage ? 'disabled' : ''}>
                    ← Previous
                </button>
                <div class="pagination-pages">
                    ${startPage > 1 ? `<button class="pagination-btn" data-page="1">1</button>` : ''}
                    ${startPage > 2 ? `<span class="pagination-ellipsis">...</span>` : ''}
                    ${pages.map(page => `
                        <button class="pagination-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">
                            ${page}
                        </button>
                    `).join('')}
                    ${endPage < totalPages - 1 ? `<span class="pagination-ellipsis">...</span>` : ''}
                    ${endPage < totalPages ? `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>` : ''}
                </div>
                <button class="pagination-btn" data-page="${currentPage + 1}" ${!hasNextPage ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
            <div class="books-pagination-info">
                Showing ${((currentPage - 1) * pagination.books?.length || 0) + 1}-${Math.min(currentPage * state.booksPerPage, pagination.totalBooks)} of ${pagination.totalBooks} books
            </div>
        `;
    }

    // --- WIDGET RENDERING ---
    function renderFullTracker(state) {
        const stats = getReadingStats();
        const pagination = paginateBooks(state.books, state.currentPage, state.booksPerPage);
        
        return `
            <div class="books-widget full-tracker">
                <div class="books-header">
                    <h3>📚 My Books</h3>
                    <div class="books-stats">
                        <span class="stat">📖 ${stats.reading} reading</span>
                        <span class="stat">✅ ${stats.finished} finished</span>
                        <span class="stat">📚 ${stats.toRead} to read</span>
                    </div>
                    <button class="book-add-btn">Add Book</button>
                </div>
                <div class="book-search-container" style="display: none;">
                    <input type="text" id="book-search-input" placeholder="Search for books to add..." class="book-search-input">
                    <div id="book-search-results" class="book-search-results hidden"></div>
                </div>
                <div class="books-content">
                    ${Object.keys(pagination.books).length === 0 ? 
                        '<p class="books-empty">No books added yet. Search above to add books!</p>' : 
                        renderBooksList(pagination.books)
                    }
                </div>
                ${renderPagination(pagination, 'full-tracker')}
            </div>
        `;
    }

    function renderBookItem(bookId, bookData, showProgress = false) {
        const status = BOOK_STATUSES[bookData.status] || BOOK_STATUSES['to-read'];
        const progressHtml = showProgress && bookData.status === 'reading' ? 
            `<div class="book-progress">
                <input type="range" min="0" max="100" value="${bookData.progress || 0}" 
                       class="book-progress-slider" data-book-id="${bookId}">
                <span class="book-progress-text">${bookData.progress || 0}%</span>
            </div>` : '';

        return `
            <div class="book-item" data-book-id="${bookId}" data-status="${bookData.status}">
                <div class="book-cover">
                    <img src="${bookData.cover || 'https://via.placeholder.com/80x120?text=Book'}" 
                         alt="${escapeHtml(bookData.title || bookId)}" onerror="this.src='https://via.placeholder.com/80x120?text=Book'">
                </div>
                <div class="book-info">
                    <h4 class="book-title">${escapeHtml(bookData.title || bookId.replace(/-/g, ' '))}</h4>
                    <p class="book-author">${escapeHtml(bookData.author || 'Unknown Author')}</p>
                    <div class="book-meta">
                        <span class="book-status-badge" style="color: ${status.color}">
                            ${status.icon} ${status.label}
                        </span>
                        <select class="book-status-select" data-book-id="${bookId}">
                            ${Object.entries(BOOK_STATUSES).map(([key, value]) => 
                                `<option value="${key}" ${bookData.status === key ? 'selected' : ''}>${value.label}</option>`
                            ).join('')}
                        </select>
                        <button class="remove-item-btn" data-book-id="${bookId}" title="Remove book">×</button>
                    </div>
                    ${progressHtml}
                </div>
            </div>
        `;
    }

    function renderBooksList(books) {
        return Object.entries(books).map(([bookId, bookData]) => 
            renderBookItem(bookId, bookData, true)
        ).join('');
    }

    function renderToReadWidget(state) {
        // Fix: state.books is an object, not an array, so we need to get the values
        const books = Object.entries(state.books)
            .filter(([_, book]) => book.status === 'to-read')
            .sort((a, b) => {
                const dateA = new Date(a[1].dateAdded || 0);
                const dateB = new Date(b[1].dateAdded || 0);
                return dateB - dateA;
            });

        if (books.length === 0) {
            return `
                <div class="books-widget to-read">
                    <div class="books-header">
                        <h3>📚 Books To Read</h3>
                        <button class="book-add-btn">Add Book</button>
                    </div>
                    <div class="book-search-container" style="display: none;">
                        <input type="text" class="book-search-input" placeholder="Search for books to add...">
                        <div class="book-search-results hidden"></div>
                    </div>
                    <div class="books-empty">
                        No books in your to-read list yet. Search above to add some!
                    </div>
                </div>
            `;
        }

        const booksHtml = books.map(([bookId, book]) => `
            <div class="book-item-simple" data-book-id="${bookId}">
                <input type="checkbox" class="book-checkbox" data-book-id="${bookId}" ${book.status === 'finished' ? 'checked' : ''}>
                <div class="book-info-simple">
                    <h4 class="book-title">${book.title}</h4>
                    <p class="book-author">${book.author}</p>
                </div>
            </div>
        `).join('');

        return `
            <div class="books-widget to-read">
                <div class="books-header">
                    <h3>📚 Books To Read</h3>
                    <button class="book-add-btn">Add Book</button>
                </div>
                <div class="book-search-container" style="display: none;">
                    <input type="text" class="book-search-input" placeholder="Search for books to add...">
                    <div class="book-search-results hidden"></div>
                </div>
                <div class="books-content">
                    ${booksHtml}
                </div>
            </div>
        `;
    }

    function renderCurrentlyReadingWidget(state) {
        const readingBooks = Object.entries(state.books)
            .filter(([_, data]) => data.status === 'reading')
            .sort((a, b) => {
                const dateA = new Date(a[1].dateAdded || 0);
                const dateB = new Date(b[1].dateAdded || 0);
                return dateB - dateA;
            });

        if (readingBooks.length === 0) {
            return `
                <div class="books-widget currently-reading-widget">
                    <p>You're not currently reading any books.</p>
                </div>
            `;
        }

        const booksHtml = readingBooks.map(([bookId, bookData]) => renderBookItem(bookId, bookData, true)).join('');

        return `
            <div class="books-widget currently-reading-widget">
                <div class="books-header">
                    <h3>📖 Currently Reading (${readingBooks.length})</h3>
                </div>
                <div class="books-content">
                    ${booksHtml}
                </div>
            </div>
        `;
    }

    function renderFinishedWidget(state) {
        const finishedBooks = Object.entries(state.books)
            .filter(([_, data]) => data.status === 'finished')
            .sort((a, b) => {
                const dateA = new Date(a[1].dateAdded || 0);
                const dateB = new Date(b[1].dateAdded || 0);
                return dateB - dateA;
            });

        if (finishedBooks.length === 0) {
            return `
                <div class="books-widget finished-widget">
                    <p>No finished books yet. Keep reading!</p>
                </div>
            `;
        }

        const booksHtml = finishedBooks.map(([bookId, bookData]) => renderBookItem(bookId, bookData)).join('');

        return `
            <div class="books-widget finished-widget">
                <div class="books-header">
                    <h3>✅ Finished Books (${finishedBooks.length})</h3>
                </div>
                <div class="books-content">
                    ${booksHtml}
                </div>
            </div>
        `;
    }

    function renderBookshelfWidget(state) {
        const allBooks = Object.entries(state.books)
            .sort((a, b) => {
                const dateA = new Date(a[1].dateAdded || 0);
                const dateB = new Date(b[1].dateAdded || 0);
                return dateB - dateA;
            });

        if (allBooks.length === 0) {
            return `
                <div class="books-widget bookshelf-widget">
                    <p>Your bookshelf is empty. Add some books!</p>
                </div>
            `;
        }

        const booksByStatus = {};
        Object.entries(BOOK_STATUSES).forEach(([key, value]) => {
            booksByStatus[key] = allBooks.filter(([_, data]) => data.status === key);
        });

        const sectionsHtml = Object.entries(booksByStatus).map(([status, books]) => {
            if (books.length === 0) return '';
            const statusInfo = BOOK_STATUSES[status];
            
            // Limit initial display to 8 books, show "Show more" for the rest
            const visibleBooks = books.slice(0, 8);
            const hiddenBooks = books.slice(8);
            
            return `
                <div class="bookshelf-section" data-status="${status}">
                    <h4 class="bookshelf-section-title">
                        <button class="section-toggle" data-status="${status}">
                            <span class="toggle-icon">▼</span>
                            ${statusInfo.icon} ${statusInfo.label} (${books.length})
                        </button>
                    </h4>
                    <div class="bookshelf-grid" data-section="${status}">
                        ${visibleBooks.map(([bookId, bookData]) => `
                            <div class="bookshelf-item" data-book-id="${bookId}">
                                <img src="${bookData.cover || 'https://placehold.co/100x150/e5e7eb/6b7280?text=Book'}" 
                                     alt="${bookData.title || bookId}" 
                                     onerror="this.src='https://placehold.co/100x150/e5e7eb/6b7280?text=Book'">
                                <div class="bookshelf-item-info">
                                    <span class="bookshelf-title">${bookData.title || bookId.replace(/-/g, ' ')}</span>
                                    <span class="bookshelf-author">${bookData.author || 'Unknown Author'}</span>
                                </div>
                            </div>
                        `).join('')}
                        ${hiddenBooks.length > 0 ? `
                            <div class="bookshelf-hidden-books" data-status="${status}" style="display: none;">
                                ${hiddenBooks.map(([bookId, bookData]) => `
                                    <div class="bookshelf-item" data-book-id="${bookId}">
                                        <img src="${bookData.cover || 'https://placehold.co/100x150/e5e7eb/6b7280?text=Book'}" 
                                             alt="${bookData.title || bookId}" 
                                             onerror="this.src='https://placehold.co/100x150/e5e7eb/6b7280?text=Book'">
                                        <div class="bookshelf-item-info">
                                            <span class="bookshelf-title">${bookData.title || bookId.replace(/-/g, ' ')}</span>
                                            <span class="bookshelf-author">${bookData.author || 'Unknown Author'}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="show-more-btn" data-status="${status}">
                                Show ${hiddenBooks.length} more books
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).filter(Boolean).join('');

        return `
            <div class="books-widget bookshelf-widget">
                <div class="books-header">
                    <h3>📚 My Bookshelf</h3>
                </div>
                <div class="books-content">
                    ${sectionsHtml}
                </div>
            </div>
        `;
    }

    function renderStatsWidget(state) {
        const stats = getReadingStats();

        return `
            <div class="books-widget stats-widget">
                <div class="books-header">
                    <h3>📊 Reading Stats</h3>
                </div>
                <div class="books-content">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">${stats.total}</span>
                            <span class="stat-label">Total Books</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.finished}</span>
                            <span class="stat-label">Finished</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.reading}</span>
                            <span class="stat-label">Currently Reading</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.toRead}</span>
                            <span class="stat-label">To Read</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- EVENT HANDLERS ---
    function setupEventListeners(container) {
        // Prevent edit mode on widget container
        container.addEventListener('click', (e) => {
            // Check if the clicked element is inside the search container or is an interactive element
            const isInsideSearch = e.target.closest('.book-search-container');
            const isInteractive = e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT';

            if (!isInsideSearch && !isInteractive) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // Add book button - individual listener like movies widget
        const addBtn = container.querySelector('.book-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const searchContainer = container.querySelector('.book-search-container');
                if (searchContainer) {
                    searchContainer.style.display = searchContainer.style.display === 'none' ? 'block' : 'none';
                    if (searchContainer.style.display === 'block') {
                        const searchInput = searchContainer.querySelector('.book-search-input');
                        if (searchInput) searchInput.focus();
                    }
                }
            });
        }

        // Book search
        const searchInput = container.querySelector('#book-search-input, .book-search-input');
        const searchResults = container.querySelector('#book-search-results, .book-search-results');

        if (searchInput && searchResults) {
            let searchTimeout;

            searchInput.addEventListener('input', (e) => {
                e.preventDefault();
                e.stopPropagation();

                clearTimeout(searchTimeout);
                const query = e.target.value.trim();

                if (query.length < 2) {
                    searchResults.classList.add('hidden');
                    return;
                }

                searchTimeout = setTimeout(async () => {
                    searchResults.innerHTML = '<div class="search-loading">Searching...</div>';
                    searchResults.classList.remove('hidden');

                    const books = await searchBooks(query);

                    if (books.length === 0) {
                        searchResults.innerHTML = '<div class="search-empty">No books found</div>';
                        return;
                    }

                    const resultsHtml = books.map(book => {
                        const bookData = formatGoogleBookData(book);
                        // Use HTML encoding for the JSON data attribute
                        const bookDataJson = JSON.stringify(bookData).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                        return `
                            <div class="search-result-item" data-book-id="${bookData.id}">
                                <img src="${bookData.cover}" alt="${bookData.title}" class="search-result-cover">
                                <div class="search-result-info">
                                    <h4 class="search-result-title">${bookData.title}</h4>
                                    <p class="search-result-author">${bookData.author}</p>
                                    <button class="search-result-add-btn" data-book-data="${bookDataJson}">Add Book</button>
                                </div>
                            </div>
                        `;
                    }).join('');

                    searchResults.innerHTML = resultsHtml;

                    // Add event listeners to add buttons
                    searchResults.querySelectorAll('.search-result-add-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                                const bookDataJson = btn.dataset.bookData.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                                const bookData = JSON.parse(bookDataJson);
                                addBook(bookData.id, bookData, 'to-read');
                                searchInput.value = '';
                                searchResults.classList.add('hidden');
                                // Hide search container after adding book
                                const searchContainer = container.querySelector('.book-search-container');
                                if (searchContainer) searchContainer.style.display = 'none';
                            } catch (error) {
                                console.error('Error parsing book data:', error);
                                alert('Error adding book. Please try again.');
                            }
                        });
                    });
                }, 300);
            });

            // Prevent edit mode when clicking in search input
            searchInput.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            // Prevent edit mode when clicking in search results
            searchResults.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            // Hide search results when clicking outside
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    searchResults.classList.add('hidden');
                }
            });
        }

        // Book status changes
        container.querySelectorAll('.book-status-select').forEach(select => {
            select.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            select.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const bookId = e.target.dataset.bookId;
                const newStatus = e.target.value;
                updateBookStatus(bookId, newStatus);
            });
        });

        // Book removal
        container.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const bookId = e.target.dataset.bookId;
                removeBook(bookId);
            });
        });

        // Progress sliders with real-time updates
        container.querySelectorAll('.book-progress-slider').forEach(slider => {
            // Function to update slider background
            const updateSliderBackground = (progressValue) => {
                const percentage = progressValue;
                slider.style.background = `linear-gradient(to right, var(--color-progress-bar) 0%, var(--color-progress-bar) ${percentage}%, var(--color-progress-bar-bg) ${percentage}%, var(--color-progress-bar-bg) 100%)`;
            };

            // Set initial progress background
            const initialProgress = parseInt(slider.value) || 0;
            updateSliderBackground(initialProgress);

            slider.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            slider.addEventListener('input', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const bookId = e.target.dataset.bookId;
                const progress = parseInt(e.target.value);

                // Update the visual progress immediately
                updateSliderBackground(progress);

                // Update the text display immediately
                const progressText = container.querySelector(`[data-book-id="${bookId}"] .book-progress-text`);
                if (progressText) {
                    progressText.textContent = `${progress}%`;
                }

                // Update the actual progress
                updateBookProgress(bookId, progress);
            });
        });

        // To-read checkboxes that work with goals - IMPROVED VERSION
        container.querySelectorAll('.book-checkbox').forEach(checkbox => {
            // Remove any existing listeners first
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);

            // Add event listeners to the fresh checkbox
            newCheckbox.addEventListener('change', (e) => {
                e.stopPropagation(); // Prevent event bubbling

                const bookId = e.target.dataset.bookId;
                const isChecked = e.target.checked;

                // Update book status based on checkbox state
                if (isChecked) {
                    updateBookStatus(bookId, 'finished');
                } else {
                    updateBookStatus(bookId, 'to-read');
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

        // Book items (prevent edit mode when clicking on book items)
        container.querySelectorAll('.book-item, .book-item-simple, .bookshelf-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Pagination handlers
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const page = parseInt(e.target.dataset.page);
                if (page && page !== state.currentPage) {
                    state.currentPage = page;
                    renderApp(); // Re-render with new page
                }
            });
        });

        // Collapsible section handlers
        container.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const status = e.target.dataset.status;
                const section = container.querySelector(`[data-status="${status}"]`);
                const icon = toggle.querySelector('.toggle-icon');
                
                section.classList.toggle('collapsed');
                toggle.classList.toggle('collapsed');
            });
        });

        // Show more buttons
        container.querySelectorAll('.show-more-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const status = e.target.dataset.status;
                const hiddenBooks = container.querySelector(`.bookshelf-hidden-books[data-status="${status}"]`);
                
                if (hiddenBooks.style.display === 'none') {
                    hiddenBooks.style.display = 'contents';
                    btn.textContent = 'Show less';
                } else {
                    hiddenBooks.style.display = 'none';
                    const hiddenCount = hiddenBooks.children.length;
                    btn.textContent = `Show ${hiddenCount} more books`;
                }
            });
        });
    }

    // --- BOOK MANAGEMENT ---
    function addBook(bookId, bookData, status = 'to-read') {
        state.books[bookId] = {
            ...bookData,
            status: status,
            progress: 0,
            dateAdded: new Date().toISOString()
        };
        saveBooksToStorage();
        renderApp();
    }

    function updateBookStatus(bookId, newStatus) {
        if (state.books[bookId]) {
            state.books[bookId].status = newStatus;
            if (newStatus === 'finished') {
                state.books[bookId].progress = 100;
                state.books[bookId].dateFinished = new Date().toISOString();
            }
            saveBooksToStorage();
            renderApp();
        }
    }

    function updateBookProgress(bookId, progress) {
        if (state.books[bookId]) {
            state.books[bookId].progress = progress;
            if (progress >= 100) {
                state.books[bookId].status = 'finished';
                state.books[bookId].dateFinished = new Date().toISOString();
            }
            saveBooksToStorage();
            renderApp();
        }
    }

    function removeBook(bookId) {
        if (state.books[bookId]) {
            const bookTitle = state.books[bookId].title || bookId.replace(/-/g, ' ');
            const message = `Are you sure you want to remove "<strong>${bookTitle}</strong>" from your library?<br><br>This action cannot be undone.`;

            // Use the existing modal confirmation system
            showConfirm(message).then((confirmed) => {
                if (confirmed) {
                    delete state.books[bookId];
                    saveBooksToStorage();
                    renderApp();
                }
            });
        }
    }

    function render(container, config) {
        currentContainer = container;
        currentConfig = config;

        loadBooksFromStorage();

        const { widgetType, books, error } = parseCommand(config);

        if (error) {
            container.innerHTML = `<div class="books-error">${error}</div>`;
            return;
        }

        let html = '';

        switch (widgetType) {
            case 'to-read':
                html = renderToReadWidget(state);
                break;
            case 'currently-reading':
                html = renderCurrentlyReadingWidget(state);
                break;
            case 'finished':
                html = renderFinishedWidget(state);
                break;
            case 'bookshelf':
                html = renderBookshelfWidget(state);
                break;
            case 'stats':
                html = renderStatsWidget(state);
                break;
            default:
                html = renderFullTracker(state);
        }

        container.innerHTML = html;
        setupEventListeners(container);
    }

    // --- INIT FUNCTION (Required by widgetRegistry) ---
    function init(options) {
        const { placeholder, config } = options;
        render(placeholder, config);
    }

    // --- PUBLIC API ---
    return {
        init,           // Required by widgetRegistry
        render,
        addBook,
        updateBookStatus,
        updateBookProgress,
        removeBook,
        searchBooks,
        getBookDetails,
        getReadingStats
    };
})();