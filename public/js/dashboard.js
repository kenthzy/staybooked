document.addEventListener('DOMContentLoaded', () => {
    // Fetch and display news
    fetch('/business-news')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(articles => {
            const container = document.getElementById('newsContainer');
            container.innerHTML = articles.map(article => `
                <div class="col">   
                    <div class="card h-100 news-card shadow-sm">
                        ${article.image ? `
                           <img src="${article.image || '/placeholder.jpg'}" 
                                class="card-img-top" 
                                alt="${article.title}"
                                onerror="this.src='/placeholder.jpg'">` : ''}
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title text-clamp">${article.title}</h5>
                            <p class="card-text text-muted text-clamp mt-2">${article.description || ''}</p>
                            <div class="mt-auto">
                                <div class="d-flex justify-content-between small text-muted mb-2">
                                    <span>${article.source}</span>
                                    <span>${article.publishedAt}</span>
                                </div>
                                <a href="${article.url}" 
                                   class="btn btn-news btn-outline-primary w-100" 
                                   target="_blank">
                                    Read Full Article
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('newsContainer').innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        Error loading news: ${error.message}
                    </div>
                </div>
            `;
        });
});


document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/user')
        .then(res => res.json())
        .then(data => {
            document.getElementById('username').textContent = data.username;
        })
        .catch(err => {
            console.error('Error getting username:', err);
            document.getElementById('username').textContent = 'Guest';
        });
});

