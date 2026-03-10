import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import "./styles.css";

const API_ALL = "https://restcountries.com/v3.1/all";
const API_NAME = "https://restcountries.com/v3.1/name/";

export default function App() {
    const [countries, setCountries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const { register, handleSubmit, reset } = useForm();

    // Fetch all countries on mount
    useEffect(() => {
        fetchAllCountries();
    }, []);

    const fetchAllCountries = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(API_ALL);
            if (!res.ok) throw new Error("Failed to fetch countries");
            const data = await res.json();
            const sorted = data.sort((a, b) =>
                a.name.common.localeCompare(b.name.common)
            );
            setCountries(sorted);
            setIsSearching(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const onSearch = async (formData) => {
        const name = formData.countryName.trim();
        if (!name) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(
                `${API_NAME}${encodeURIComponent(name)}`
            );
            if (res.status === 404) {
                setCountries([]);
                setError(`No country found for "${name}"`);
                return;
            }
            if (!res.ok) throw new Error("Failed to search");
            const data = await res.json();
            setCountries(data);
            setIsSearching(true);
        } catch (err) {
            setError(err.message);
            setCountries([]);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        reset();
        fetchAllCountries();
    };

    const formatPopulation = (num) =>
        num ? num.toLocaleString("en-US") : "N/A";

    return (
        <div className="app">
            <header className="header">
                <h1>🌍 World Countries Explorer</h1>
                <p className="subtitle">
                    Discover information about every country in the world
                </p>
            </header>

            {/* Search Form */}
            <form className="search-form" onSubmit={handleSubmit(onSearch)}>
                <div className="search-wrapper">
                    <input
                        type="text"
                        placeholder="Search for a country..."
                        className="search-input"
                        {...register("countryName", { required: true })}
                    />
                    <button type="submit" className="btn btn-search">
                        🔍 Search
                    </button>
                    {isSearching && (
                        <button
                            type="button"
                            className="btn btn-reset"
                            onClick={handleReset}
                        >
                            ↩ Reset
                        </button>
                    )}
                </div>
            </form>

            {/* Status */}
            {loading && (
                <div className="status">
                    <div className="spinner"></div>
                    <p>Loading countries...</p>
                </div>
            )}

            {error && !loading && (
                <div className="status error-msg">
                    <p>⚠️ {error}</p>
                    <button className="btn btn-reset" onClick={handleReset}>
                        Show all countries
                    </button>
                </div>
            )}

            {/* Results count */}
            {!loading && !error && (
                <p className="result-count">
                    Showing <strong>{countries.length}</strong> countries
                    {isSearching && " (filtered)"}
                </p>
            )}

            {/* Country Cards */}
            {!loading && (
                <div className="cards-grid">
                    {countries.map((country) => (
                        <div className="card" key={country.cca3}>
                            <div className="card-flag">
                                <img
                                    src={country.flags?.svg || country.flags?.png}
                                    alt={`Flag of ${country.name.common}`}
                                    loading="lazy"
                                />
                            </div>
                            <div className="card-body">
                                <h2 className="card-title">{country.name.common}</h2>
                                <div className="card-info">
                                    <p>
                                        <span className="label">👥 Population:</span>
                                        <span>{formatPopulation(country.population)}</span>
                                    </p>
                                    <p>
                                        <span className="label">🏛️ Capital:</span>
                                        <span>
                                            {country.capital ? country.capital.join(", ") : "N/A"}
                                        </span>
                                    </p>
                                    <p>
                                        <span className="label">🌏 Continent:</span>
                                        <span>
                                            {country.continents
                                                ? country.continents.join(", ")
                                                : "N/A"}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
